import express from 'express';
import crypto from 'crypto';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import Reserva from '../models/Reserva.js';

const router = express.Router();

// Mercado Pago firma cada aviso con HMAC-SHA256 sobre un manifiesto
// armado con el id del recurso, el id de la petición y la marca de tiempo.
// Sin esta comprobación cualquiera puede mandar un POST y dar por pagada
// una reserva que nadie cobró.
function firmaValida(req) {
  const secreto = process.env.MP_WEBHOOK_SECRET;
  // Sin secreto no hay forma de comprobar que el aviso venga de Mercado
  // Pago: tratarlo como "no verificado" y dejarlo pasar permitiría que
  // cualquiera marque una reserva como pagada con un POST directo.
  if (!secreto) {
    console.error('MP_WEBHOOK_SECRET no configurado: rechazando el webhook');
    return false;
  }

  const cabecera = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'];
  if (!cabecera || !requestId) return false;

  const partes = Object.fromEntries(
    String(cabecera).split(',').map(p => p.split('=').map(s => s.trim()))
  );
  const { ts, v1 } = partes;
  if (!ts || !v1) return false;

  const dataId = String(req.query['data.id'] || req.body?.data?.id || '').toLowerCase();
  const manifiesto = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const esperada = crypto.createHmac('sha256', secreto).update(manifiesto).digest('hex');

  // Comparación en tiempo constante: un `===` filtra información por el
  // tiempo que tarda en encontrar la primera diferencia.
  const a = Buffer.from(esperada, 'utf8');
  const b = Buffer.from(String(v1), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// POST /api/webhooks/mercadopago
router.post('/mercadopago', async (req, res) => {
  try {
    if (!firmaValida(req)) {
      console.warn('Webhook con firma inválida o sin verificar, descartado');
      return res.status(401).json({ error: 'Firma inválida' });
    }

    const { type, data } = req.body;
    if (type !== 'payment') return res.json({ ok: true });   // otros eventos se ignoran
    if (!data?.id) return res.status(400).json({ error: 'ID de pago requerido' });

    if (!process.env.MP_ACCESS_TOKEN) {
      console.error('MP_ACCESS_TOKEN no configurado');
      return res.status(503).json({ error: 'Pagos no disponibles' });
    }

    // El estado se le pregunta a Mercado Pago. Nunca se toma del cuerpo
    // de la petición, que lo controla quien la envía.
    const cliente = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const pago = await new Payment(cliente).get({ id: data.id });

    const folio = pago.external_reference;
    if (!folio) {
      console.warn(`Pago ${data.id} sin folio asociado`);
      return res.json({ ok: true });
    }

    const reserva = await Reserva.findOne({ folio });
    if (!reserva) {
      console.warn(`Pago ${data.id} apunta al folio ${folio}, que no existe`);
      return res.json({ ok: true });
    }

    const MAPA = { approved: 'pagado', refunded: 'reembolsado', charged_back: 'reembolsado' };
    const nuevoEstado = MAPA[pago.status];

    if (nuevoEstado && reserva.estadoPago !== nuevoEstado) {
      reserva.estadoPago = nuevoEstado;
      reserva.mpPaymentId = String(data.id);
      await reserva.save();
      console.log(`Reserva ${folio}: pago ${pago.status} → ${nuevoEstado}`);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Error webhook MP:', err.message);
    // 500 hace que Mercado Pago reintente el aviso más tarde
    res.status(500).json({ error: 'Error procesando webhook' });
  }
});

export default router;
