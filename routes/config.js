import express from 'express';
import SiteConfig from '../models/SiteConfig.js';
import { authMiddleware, ownerMiddleware } from '../middleware/auth.js';

const router = express.Router();

// GET /api/config/estado — público, el frontend lo consulta en cada carga
// para saber si debe mostrar el sitio o la página de mantenimiento.
router.get('/estado', async (req, res) => {
  try {
    const config = await SiteConfig.obtener();
    res.json({ ok: true, mantenimiento: config.mantenimiento });
  } catch (err) {
    // Si falla la consulta, no tumbamos el sitio: se asume que está activo.
    res.json({ ok: true, mantenimiento: false });
  }
});

// PATCH /api/config/mantenimiento — solo el dueño puede encender/apagar el sitio.
router.patch('/mantenimiento', authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    if (typeof req.body.activo !== 'boolean') {
      return res.status(400).json({ error: 'Falta el campo "activo" (boolean)' });
    }
    const config = await SiteConfig.obtener();
    config.mantenimiento = req.body.activo;
    config.actualizadoEn = new Date();
    config.actualizadoPor = req.user.email;
    await config.save();
    res.json({ ok: true, mantenimiento: config.mantenimiento });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar el modo mantenimiento' });
  }
});

export default router;
