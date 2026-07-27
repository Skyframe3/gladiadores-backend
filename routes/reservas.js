import express from 'express';
import Counter from '../models/Counter.js';
import Reserva from '../models/Reserva.js';

const router = express.Router();

// POST /api/reservas — Crear nueva reserva con folio secuencial
router.post('/', async (req, res) => {
  try {
    const { nombre, email, whatsapp, ruta, unidad, horario, fecha, asientos, extras, monto, modoPago, metodoPago } = req.body;

    // Validar campos obligatorios
    if (!nombre || !email || !whatsapp || !ruta || !unidad || !horario || !fecha || !asientos || !monto) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

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
      mensaje: `Reserva ${folio} creada exitosamente`,
      reserva
    });
  } catch (err) {
    console.error('Error al crear reserva:', err);
    res.status(500).json({ error: 'Error al crear la reserva' });
  }
});

// GET /api/reservas — Listar todas las reservas (admin)
router.get('/', async (req, res) => {
  try {
    const reservas = await Reserva.find().sort({ creadaEn: -1 });
    res.json({ ok: true, total: reservas.length, reservas });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener reservas' });
  }
});

// GET /api/reservas/:folio — Buscar reserva por folio
router.get('/:folio', async (req, res) => {
  try {
    const reserva = await Reserva.findOne({ folio: req.params.folio.toUpperCase() });
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
    res.json({ ok: true, reserva });
  } catch (err) {
    res.status(500).json({ error: 'Error al buscar reserva' });
  }
});

// PATCH /api/reservas/:folio/estado — Cambiar estado (admin: cancelar, completar, etc.)
router.patch('/:folio/estado', async (req, res) => {
  try {
    const { estado } = req.body;
    const validos = ['confirmada', 'cancelada', 'completada', 'no_show'];
    if (!validos.includes(estado)) {
      return res.status(400).json({ error: `Estado inválido. Opciones: ${validos.join(', ')}` });
    }

    const reserva = await Reserva.findOneAndUpdate(
      { folio: req.params.folio.toUpperCase() },
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
