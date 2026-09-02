import express from 'express';
import SiteConfig from '../models/SiteConfig.js';
import { authMiddleware, ownerMiddleware } from '../middleware/auth.js';

const router = express.Router();

// GET /api/config/estado — público, el frontend lo consulta en cada carga
// para saber si debe mostrar el sitio o la página de mantenimiento.
router.get('/estado', async (req, res) => {
  try {
    const config = await SiteConfig.obtener();
    res.json({ ok: true, mantenimiento: config.mantenimiento, reservasPausadas: config.reservasPausadas });
  } catch (err) {
    // Si falla la consulta: el sitio se asume activo (no tumbarlo por un
    // hipo de red), pero las reservas se asumen pausadas — mejor mostrar
    // "ya casi" de más que dejar pasar una reserva sin poder cobrarla.
    res.json({ ok: true, mantenimiento: false, reservasPausadas: true });
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

// PATCH /api/config/reservas — solo el dueño puede abrir/pausar las reservas.
router.patch('/reservas', authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    if (typeof req.body.pausadas !== 'boolean') {
      return res.status(400).json({ error: 'Falta el campo "pausadas" (boolean)' });
    }
    const config = await SiteConfig.obtener();
    config.reservasPausadas = req.body.pausadas;
    config.actualizadoEn = new Date();
    config.actualizadoPor = req.user.email;
    await config.save();
    res.json({ ok: true, reservasPausadas: config.reservasPausadas });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar el estado de las reservas' });
  }
});

export default router;
