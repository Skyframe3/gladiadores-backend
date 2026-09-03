import express from 'express';
import Counter from '../models/Counter.js';
import Reserva from '../models/Reserva.js';
import Ruta from '../models/Ruta.js';
import Unidad from '../models/Unidad.js';
import { authMiddleware, adminMiddleware, reservasMiddleware } from '../middleware/auth.js';
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

    const { nombre, email, whatsapp, ruta, rutaId, horario, fecha, extras, modoPago, nota } = req.body;
    // unidades: [{categoriaId:'maverick-4', personas:4}, {categoriaId:'cuatrimoto-2', personas:2}, ...]
    const pedidas = Array.isArray(req.body.unidades) ? req.body.unidades : [];

    if (!pedidas.length) return res.status(400).json({ error: 'Elige al menos una unidad' });
    if (pedidas.length > 8) return res.status(400).json({ error: 'Máximo 8 unidades por reserva' });

    const rutaObj = await Ruta.findOne({ rid: rutaId, activo: true });
    if (!rutaObj) return res.status(404).json({ error: 'Esa ruta ya no está disponible' });

    if (Array.isArray(rutaObj.diasActivos) && rutaObj.diasActivos.length > 0 && !rutaObj.diasActivos.includes(fecha)) {
      return res.status(409).json({ error: 'Esa fecha no está disponible para esta ruta' });
    }

    // El precio SIEMPRE sale del catálogo del panel, nunca del cliente:
    // así nadie puede mandar un Maverick de $5,800 con precio inventado.
    const renglones = [];
    let montoTotal = 0;
    let personasTotal = 0;

    for (const p of pedidas) {
      const categoria = rutaObj.units.find(u => u.id === p.categoriaId);
      if (!categoria || !categoria.activo) {
        return res.status(409).json({ error: 'Una de las unidades ya no se ofrece en esta ruta' });
      }
      const personas = Number(p.personas);
      const tarifa = (categoria.tarifas || []).find(t => t.personas === personas && t.precio > 0);
      if (!tarifa) {
        return res.status(409).json({ error: `${categoria.name}: no hay tarifa para ${p.personas} personas` });
      }
      renglones.push({ categoriaId: categoria.id, nombre: categoria.name, personas, precio: tarifa.precio });
      montoTotal += tarifa.precio;
      personasTotal += personas;
    }

    // Asignar máquinas físicas concretas, sin repetir dentro de la misma
    // reserva: si piden 2 cuatrimotos, se apartan dos distintas.
    const ocupadas = await unidadesOcupadasEnFecha(fecha);
    const yaAsignadas = new Set();

    for (const r of renglones) {
      const [tipo, plazas] = r.categoriaId.split('-');
      const libre = await Unidad.findOne({
        tipo,
        plazas: Number(plazas),
        activo: true,
        codigo: { $nin: [...Array.from(ocupadas), ...Array.from(yaAsignadas)] }
      }).sort({ orden: 1 });

      if (!libre) {
        return res.status(409).json({ error: `Ya no hay ${r.nombre} disponible para esa fecha. Ajusta tu selección.` });
      }
      r.codigo = libre.codigo;
      r.nombre = libre.nombreCompleto;
      yaAsignadas.add(libre.codigo);
    }

    const folio = await Counter.getNextFolio();

    const reserva = new Reserva({
      folio,
      cliente: { nombre, email, whatsapp },
      ruta,
      rutaId,
      horario,
      fecha: new Date(fecha),
      unidades: renglones,
      personas: personasTotal,
      extras: extras || [],
      nota: (nota || '').slice(0, 600),
      montoTotal,
      montoPagado: 0,
      modoPago: modoPago || 'anticipo',
      metodoPago: 'transferencia',
      estadoPago: 'pendiente',
      estado: 'pendiente'
    });

    // Revalida justo antes de guardar: acorta la ventana de carrera, pero
    // quien de verdad la cierra es el índice único del modelo (error 11000).
    const ocupadasAhora = await unidadesOcupadasEnFecha(fecha);
    if (renglones.some(r => ocupadasAhora.has(r.codigo))) {
      return res.status(409).json({ error: 'Alguien más acaba de apartar una de esas unidades. Intenta de nuevo.' });
    }

    try {
      await reserva.save();
    } catch (dupErr) {
      if (dupErr.code === 11000) {
        return res.status(409).json({ error: 'Alguien más acaba de apartar una de esas unidades. Intenta de nuevo.' });
      }
      throw dupErr;
    }

    setImmediate(() => enviarConfirmacionReserva(reserva));

    const anticipo = Math.round(montoTotal * 0.25);
    res.status(201).json({
      ok: true,
      folio: reserva.folio,
      unidades: renglones.map(r => ({ nombre: r.nombre, personas: r.personas, precio: r.precio })),
      montoTotal,
      anticipo,
      modoPago: reserva.modoPago,
      estado: reserva.estado,
      mensaje: `Solicitud ${folio} recibida. Queda apartada mientras se valida tu transferencia.`
    });
  } catch (err) {
    console.error('Error al crear reserva:', err);
    res.status(500).json({ error: 'Error al crear la reserva' });
  }
});

// GET /api/reservas — Listar todas las reservas (admin solamente)
router.get('/', authMiddleware, reservasMiddleware, async (req, res) => {
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

// PATCH /api/reservas/:folio/pago — Registrar que llegó la transferencia.
// Al aprobar, la reserva pasa a 'confirmada' y queda el rastro de quién
// la aprobó: es el momento en que el lugar deja de ser tentativo.
router.patch('/:folio/pago', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reserva = await Reserva.findOne({ folio: req.params.folio });
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

    const monto = Number(req.body.montoPagado);
    if (!Number.isFinite(monto) || monto < 0 || monto > reserva.montoTotal) {
      return res.status(400).json({ error: `El monto debe estar entre 0 y ${reserva.montoTotal}` });
    }

    reserva.montoPagado = monto;
    reserva.estadoPago = monto <= 0 ? 'pendiente' : (monto >= reserva.montoTotal ? 'pagado' : 'anticipo');

    // Con dinero encima, la reserva deja de ser una solicitud y se confirma.
    if (monto > 0 && reserva.estado === 'pendiente') {
      reserva.estado = 'confirmada';
      reserva.aprobadaPor = req.user.email;
      reserva.aprobadaEn = new Date();
    }

    await reserva.save();
    res.json({ ok: true, reserva, mensaje: `Pago registrado: $${monto} de $${reserva.montoTotal}` });
  } catch (err) {
    console.error('Error al registrar pago:', err.message);
    res.status(500).json({ error: 'Error al registrar el pago' });
  }
});

// PATCH /api/reservas/:folio/estado — Cambiar estado (admin solamente)
router.patch('/:folio/estado', authMiddleware, reservasMiddleware, validateEstado, async (req, res) => {
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
