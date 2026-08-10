import express from 'express';
import AgenteConfig from '../models/AgenteConfig.js';
import { authMiddleware, ownerMiddleware } from '../middleware/auth.js';

const router = express.Router();

// GET /api/admin/agente — leer configuración actual (solo dueño)
router.get('/', authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    const config = await AgenteConfig.obtener();
    res.json({ ok: true, config });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener la configuración del agente' });
  }
});

// PATCH /api/admin/agente — activar/desactivar y editar instrucciones (solo dueño)
router.patch('/', authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    const cambios = { actualizadoEn: new Date() };
    if (typeof req.body.activo === 'boolean') cambios.activo = req.body.activo;
    if (typeof req.body.instrucciones === 'string') {
      cambios.instrucciones = req.body.instrucciones.slice(0, 2000);
    }

    const config = await AgenteConfig.findOneAndUpdate({}, cambios, {
      new: true,
      upsert: true
    });
    res.json({ ok: true, config });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar la configuración del agente' });
  }
});

export default router;
