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
const CAMPOS_EDITABLES = ['name', 'tag', 'desc', 'dur', 'dist', 'diff', 'activo', 'orden', 'terrain', 'img'];

// Categorías de las que solo existe UNA máquina física en toda la flotilla
// (ver models/Unidad.js: Minimi es el único Commander de 2 plazas, Don Mave
// el único Maverick de 2 plazas). Si el dueño la marca ocupada en una ruta,
// físicamente no puede estar libre en ninguna otra: hay que apagarla en
// todas a la vez o se podría vender dos veces la misma unidad.
const CATEGORIAS_UNICAS = ['commander-2', 'maverick-2'];

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

    // Galería: hasta 10 fotos, cada una una ruta o URL corta y sin caracteres raros
    if (Array.isArray(req.body.galeria)) {
      ruta.galeria = req.body.galeria
        .filter(g => typeof g === 'string' && g.trim().length > 0 && g.length <= 500)
        .slice(0, 10)
        .map(g => g.trim());
    }

    // Video: liga de Instagram o YouTube únicamente
    if (typeof req.body.video === 'string') {
      const v = req.body.video.trim();
      if (v === '' || /^https:\/\/(www\.)?(youtube\.com|youtu\.be|instagram\.com)\//.test(v)) {
        ruta.video = v;
      } else {
        return res.status(400).json({ error: 'video: solo se aceptan ligas de YouTube o Instagram' });
      }
    }

    // Horarios: llegan como [{hora, activo}]
    if (Array.isArray(req.body.horarios)) {
      ruta.horarios = req.body.horarios
        .filter(h => h && typeof h.hora === 'string' && /^\d{1,2}:\d{2}$/.test(h.hora))
        .map(h => ({ hora: h.hora, activo: h.activo !== false }));
    }

    // Unidades: precio, asientos bloqueados y switch de activo
    const idsUnicasParaSincronizar = new Map(); // id de categoría -> nuevo activo
    if (Array.isArray(req.body.units)) {
      for (const cambio of req.body.units) {
        const unidad = ruta.units.find(u => u.id === cambio.id);
        if (!unidad) continue;

        if (cambio.price !== undefined) {
          const precio = Number(cambio.price);
          if (Number.isFinite(precio) && precio >= 0) unidad.price = precio;
        }
        // Tarifas por número de personas. Se ignoran las que no caben en la
        // unidad para que el panel no pueda vender un Commander de 4 a 6 gentes.
        if (Array.isArray(cambio.tarifas)) {
          const vistas = new Set();
          unidad.tarifas = cambio.tarifas
            .map(t => ({ personas: Number(t?.personas), precio: Number(t?.precio) }))
            .filter(t =>
              Number.isInteger(t.personas) && t.personas >= 1 && t.personas <= unidad.seats &&
              Number.isFinite(t.precio) && t.precio >= 0 &&
              !vistas.has(t.personas) && vistas.add(t.personas)
            )
            .sort((a, b) => a.personas - b.personas);
        }
        if (cambio.activo !== undefined) {
          const nuevoActivo = !!cambio.activo;
          if (unidad.activo !== nuevoActivo && CATEGORIAS_UNICAS.includes(unidad.id)) {
            idsUnicasParaSincronizar.set(unidad.id, nuevoActivo);
          }
          unidad.activo = nuevoActivo;
        }
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

    // Solo existe una máquina física de estas categorías: si aquí quedó
    // ocupada (o libre), en cualquier otra ruta tiene que verse igual.
    let rutasSincronizadas = 0;
    if (idsUnicasParaSincronizar.size > 0) {
      for (const [idUnidad, nuevoActivo] of idsUnicasParaSincronizar) {
        const resultado = await Ruta.updateMany(
          { rid: { $ne: rid }, 'units.id': idUnidad },
          { $set: { 'units.$[u].activo': nuevoActivo, actualizadaEn: new Date() } },
          { arrayFilters: [{ 'u.id': idUnidad }] }
        );
        rutasSincronizadas += resultado.modifiedCount || 0;
      }
    }

    res.json({
      ok: true,
      mensaje: `Ruta "${ruta.name}" actualizada` + (rutasSincronizadas > 0 ? ` · sincronizada en ${rutasSincronizadas} ruta(s) más` : ''),
      ruta,
      rutasSincronizadas
    });
  } catch (err) {
    console.error('Error al actualizar ruta:', err.message);
    res.status(500).json({ error: 'Error al actualizar la ruta' });
  }
});

export default router;
