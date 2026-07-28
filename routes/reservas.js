import express from 'express';
import Counter from '../models/Counter.js';
import Reserva from '../models/Reserva.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { validateReserva, validateEstado } from '../middleware/validation.js';

const router = express.Router();

// POST /api/reservas — Crear nueva reserva con folio secuencial (sin auth para clientes)
router.post('/', validateReserva, async (req, res) => {
  try {
    const { nombre, email, whatsapp, ruta, unidad, horario, fecha, asientos, extras, monto, modoPago, metodoPago } = req.body;

    // Generar folio secuencial
    const folio = await Counter.getNextFolio();

    // Crear reserva
    const reserva = new Reserva({
      folio,
      cliente: { nombre, email, whatsapp },
      ruta,
      unidad,
      horario,
      fecha: new Date(fecha),
      asientos,
      extras: extras || [],
      monto,
      modoPago: modoPago || 'anticipo',
      metodoPago: metodoPago || 'mercadopago'
    });

    await reserva.save();

    // TODO Fase 3: Enviar WhatsApp real via Twilio
    // TODO Fase 5: Crear pago en Mercado Pago

    res.status(201).json({
      ok: true,
      folio: reserva.folio,
      mensaje: `Reserva ${folio} creada exitosamente`
    });
  } catch (err) {
    console.error('Error al crear reserva:', err);
    res.status(500).json({ error: 'Error al crear la reserva' });
  }
});

// GET /api/reservas — Listar todas las reservas (admin solamente)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reservas = await Reserva.find().sort({ creadaEn: -1 });
    res.json({ ok: true, total: reservas.length, reservas });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener reservas' });
  }
});

// GET /api/reservas/:folio — Buscar reserva por folio (admin solamente)
router.get('/:folio', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const folio = String(req.params.folio).toUpperCase().trim();
    if (!/^GOR-\d{4}$/.test(folio)) {
      return res.status(400).json({ error: 'Formato de folio inválido' });
    }
    const reserva = await Reserva.findOne({ folio });
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
    res.json({ ok: true, reserva });
  } catch (err) {
    res.status(500).json({ error: 'Error al buscar reserva' });
  }
});

// PATCH /api/reservas/:folio/estado — Cambiar estado (admin solamente)
router.patch('/:folio/estado', authMiddleware, adminMiddleware, validateEstado, async (req, res) => {
  try {
    const folio = String(req.params.folio).toUpperCase().trim();
    if (!/^GOR-\d{4}$/.test(folio)) {
      return res.status(400).json({ error: 'Formato de folio inválido' });
    }
    const { estado } = req.body;

    const reserva = await Reserva.findOneAndUpdate(
      { folio },
      { estado, actualizadaEn: new Date() },
      { new: true }
    );
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

    res.json({ ok: true, mensaje: `Reserva ${reserva.folio} actualizada a "${estado}"`, reserva });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar reserva' });
  }
});

export default router;
