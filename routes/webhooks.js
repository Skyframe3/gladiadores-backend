import express from 'express';
import Reserva from '../models/Reserva.js';

const router = express.Router();

// POST /api/webhooks/mercadopago
// Recibe notificaciones de pago de Mercado Pago
router.post('/mercadopago', async (req, res) => {
  try {
    // Mercado Pago envía: { type: 'payment', data: { id: <payment_id> } }
    const { type, data } = req.body;

    // Solo procesa pagos
    if (type !== 'payment') {
      return res.json({ ok: true });
    }

    if (!data || !data.id) {
      return res.status(400).json({ error: 'ID de pago requerido' });
    }

    // TODO: Usar Mercado Pago SDK para obtener detalles del pago
    // const mp = new MercadoPagoClient({ access_token: process.env.MP_ACCESS_TOKEN });
    // const paymentDetails = await mp.payment.get(data.id);

    // Por ahora, simulamos:
    const paymentId = data.id;
    const status = req.body.status || 'approved'; // En prod, vendría de MP

    // Buscar la reserva por payment ID (necesitamos guardar esto al crear la reserva)
    // UPDATE: guardaremos el payment ID en la reserva cuando se cree
    const reserva = await Reserva.findOne({ mpPaymentId: paymentId });

    if (!reserva) {
      // Si no existe, podría ser un pago huérfano. Log pero no falla.
      console.warn(`Pago recibido pero no hay reserva: ${paymentId}`);
      return res.json({ ok: true });
    }

    // Actualizar estado según Mercado Pago
    if (status === 'approved') {
      reserva.estadoPago = 'pagado';
      await reserva.save();
      console.log(`✅ Pago confirmado para reserva ${reserva.folio}`);
    } else if (status === 'refunded') {
      reserva.estadoPago = 'reembolsado';
      await reserva.save();
      console.log(`💸 Pago reembolsado para reserva ${reserva.folio}`);
    }

    res.json({ ok: true, folio: reserva.folio });
  } catch (err) {
    console.error('Error webhook MP:', err);
    res.status(500).json({ error: 'Error procesando webhook' });
  }
});

export default router;
