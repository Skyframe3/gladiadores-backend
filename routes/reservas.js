import express from 'express';
import Counter from '../models/Counter.js';
import Reserva from '../models/Reserva.js';
import Ruta from '../models/Ruta.js';
import Unidad from '../models/Unidad.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { validateReserva, validateEstado } from '../middleware/validation.js';
import { enviarConfirmacionReserva } from '../services/whatsapp.js';
import { unidadesOcupadasEnFecha } from './disponibilidad.js';
import SiteConfig from '../models/SiteConfig.js';

const router = express.Router();

// POST /api/reservas — Crear nueva reserva con folio secuencial (sin auth para clientes)
//
// El cliente elige una CATEGORÍA (ej. "maverick-4"), nunca una máquina
// específica: cuál apodo le toca (Máximo, Espartano...) lo decide el
// servidor aquí mismo, checando en tiempo real cuáles de las unidades
// reales de esa categoría siguen libres ese día. Así una sola máquina
// nunca puede quedar vendida dos veces el mismo día, sin importar en
// qué ruta se haya reservado.
// Antes que nada, incluso antes de validar los datos: si las reservas
// están pausadas, cualquiera que le pegue a este endpoint (con datos
// buenos o mal formados) ve el mismo aviso, no un error de validación.
router.post('/', async (req, res, next) => {
  try {
    const config = await SiteConfig.obtener();
    if (config.reservasPausadas) {
      return res.status(503).json({ error: 'Estamos afinando el pago en línea. Muy pronto podrás reservar aquí mismo.' });
    }
    next();
  } catch (err) {
    next(); // si falla la consulta, sigue al flujo normal (que valida y falla seguro)
  }
}, validateReserva, async (req, res) => {
  try {

    const { nombre, email, whatsapp, ruta, rutaId, categoriaId, horario, fecha, personas, extras, modoPago } = req.body;

    const rutaObj = await Ruta.findOne({ rid: rutaId, activo: true });
    if (!rutaObj) return res.status(404).json({ error: 'Esa ruta ya no está disponible' });

    if (Array.isArray(rutaObj.diasActivos) && rutaObj.diasActivos.length > 0 && !rutaObj.diasActivos.includes(fecha)) {
      return res.status(409).json({ error: 'Esa fecha no está disponible para esta ruta' });
    }

    const categoria = rutaObj.units.find(u => u.id === categoriaId);
    if (!categoria || !categoria.activo) {
      return res.status(409).json({ error: 'Esa unidad ya no se ofrece en esta ruta' });
    }

    // El precio es el que el dueño puso en el panel para esa unidad y ese
    // número de personas, nunca el que mande el cliente: así nadie puede
    // reservar un Maverick de $5800 pagando lo que quiera.
    const tarifa = (categoria.tarifas || []).find(t => t.personas === personas && t.precio > 0);
    if (!tarifa) {
      return res.status(409).json({ error: 'Esa unidad no tiene tarifa para esa cantidad de personas' });
    }
    const montoTotal = tarifa.precio;
    const monto = modoPago === 'completo' ? montoTotal : Math.round(montoTotal * 0.25);

    const ocupadas = await unidadesOcupadasEnFecha(fecha);
    const libre = await Unidad.findOne({
      tipo: categoria.id.split('-')[0],
      plazas: Number(categoria.id.split('-')[1]),
      activo: true,
      codigo: { $nin: Array.from(ocupadas) }
    }).sort({ orden: 1 });

    if (!libre) {
      return res.status(409).json({ error: 'Ya no hay unidades disponibles para esa fecha. Elige otra fecha u otra unidad.' });
    }

    // Generar folio secuencial
    const folio = await Counter.getNextFolio();

    // Crear reserva
    const reserva = new Reserva({
      folio,
      cliente: { nombre, email, whatsapp },
      ruta,
      rutaId,
      unidad: libre.nombreCompleto,
      unidadCodigo: libre.codigo,
      horario,
      fecha: new Date(fecha),
      personas,
      extras: extras || [],
      monto,
      montoTotal,
      modoPago: modoPago || 'anticipo',
      metodoPago: 'whatsapp'
    });

    // Revalida justo antes de guardar: reduce la ventana de la carrera,
    // pero no la cierra del todo (dos requests casi simultáneas pueden
    // pasar las dos este check). Quien de verdad la cierra es el índice
    // único parcial en el modelo — si dos reservas por la misma unidad
    // y fecha llegan a save() casi al mismo tiempo, MongoDB deja pasar
    // la primera y la segunda cae en el catch de abajo con error 11000.
    const ocupadasAhora = await unidadesOcupadasEnFecha(fecha);
    if (ocupadasAhora.has(libre.codigo)) {
      return res.status(409).json({ error: 'Alguien más acaba de apartar esa unidad. Intenta de nuevo.' });
    }

    try {
      await reserva.save();
    } catch (dupErr) {
      if (dupErr.code === 11000) {
        return res.status(409).json({ error: 'Alguien más acaba de apartar esa unidad. Intenta de nuevo.' });
      }
      throw dupErr;
    }

    // Enviar confirmación por WhatsApp en background (no espera)
    setImmediate(() => enviarConfirmacionReserva(reserva));

    res.status(201).json({
      ok: true,
      folio: reserva.folio,
      unidad: libre.nombreCompleto,
      monto,
      montoTotal,
      modoPago: reserva.modoPago,
      mensaje: `Reserva ${folio} creada.`
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
