import express from 'express';
import Ruta from '../models/Ruta.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = express.Router();

// GET /api/catalogo — público. Solo rutas activas, ya filtradas.
router.get('/', async (req, res) => {
  try {
    const rutas = await Ruta.find({ activo: true }).sort({ orden: 1, rid: 1 });
    res.json({ ok: true, rutas: rutas.map(r => r.toPublico()) });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener el catálogo' });
  }
});

// GET /api/catalogo/admin — todo el catálogo con los switches visibles
router.get('/admin', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rutas = await Ruta.find().sort({ orden: 1, rid: 1 });
    res.json({ ok: true, total: rutas.length, rutas });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener el catálogo' });
  }
});

// Campos que el panel puede tocar. Lo demás se ignora.
const CAMPOS_EDITABLES = ['name', 'tag', 'desc', 'dur', 'dist', 'diff', 'activo', 'orden', 'terrain'];

// PATCH /api/catalogo/:rid — actualizar una ruta
router.patch('/:rid', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rid = Number(req.params.rid);
    if (!Number.isInteger(rid)) {
      return res.status(400).json({ error: 'Id de ruta inválido' });
    }

    const ruta = await Ruta.findOne({ rid });
    if (!ruta) return res.status(404).json({ error: 'Ruta no encontrada' });

    for (const campo of CAMPOS_EDITABLES) {
      if (req.body[campo] !== undefined) ruta[campo] = req.body[campo];
    }

    // Horarios: llegan como [{hora, activo}]
    if (Array.isArray(req.body.horarios)) {
      ruta.horarios = req.body.horarios
        .filter(h => h && typeof h.hora === 'string' && /^\d{1,2}:\d{2}$/.test(h.hora))
        .map(h => ({ hora: h.hora, activo: h.activo !== false }));
    }

    // Unidades: precio, asientos bloqueados y switch de activo
    if (Array.isArray(req.body.units)) {
      for (const cambio of req.body.units) {
        const unidad = ruta.units.find(u => u.id === cambio.id);
        if (!unidad) continue;

        if (cambio.price !== undefined) {
          const precio = Number(cambio.price);
          if (Number.isFinite(precio) && precio >= 0) unidad.price = precio;
        }
        if (cambio.activo !== undefined) unidad.activo = !!cambio.activo;
        if (cambio.name !== undefined) unidad.name = String(cambio.name);
        if (Array.isArray(cambio.booked)) {
          unidad.booked = cambio.booked
            .map(Number)
            .filter(n => Number.isInteger(n) && n >= 1 && n <= unidad.seats);
        }
      }
    }

    ruta.actualizadaEn = new Date();
    await ruta.save();

    res.json({ ok: true, mensaje: `Ruta "${ruta.name}" actualizada`, ruta });
  } catch (err) {
    console.error('Error al actualizar ruta:', err.message);
    res.status(500).json({ error: 'Error al actualizar la ruta' });
  }
});

export default router;
