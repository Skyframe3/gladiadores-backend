import express from 'express';
import PromoCode from '../models/PromoCode.js';
import { authMiddleware, ownerMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    const promos = await PromoCode.find().sort({ creadoEn: -1 });
    res.json({ ok: true, promos });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener promociones' });
  }
});

router.post('/', authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    const { codigo, porcentaje, usosMaximos, vigenciaInicio, vigenciaFin } = req.body;

    if (!codigo || typeof codigo !== 'string' || codigo.trim().length < 3 || codigo.trim().length > 30) {
      return res.status(400).json({ error: 'El código debe tener entre 3 y 30 caracteres' });
    }
    if (!/^[A-Z0-9_-]+$/i.test(codigo.trim())) {
      return res.status(400).json({ error: 'El código solo puede tener letras, números, guiones y guiones bajos' });
    }

    const pct = Number(porcentaje);
    if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
      return res.status(400).json({ error: 'El porcentaje debe ser entre 1 y 100' });
    }

    const usos = Number(usosMaximos);
    if (!Number.isInteger(usos) || usos < 1 || usos > 10000) {
      return res.status(400).json({ error: 'Los usos máximos deben ser entre 1 y 10,000' });
    }

    const inicio = new Date(vigenciaInicio);
    const fin = new Date(vigenciaFin);
    if (isNaN(inicio) || isNaN(fin) || fin <= inicio) {
      return res.status(400).json({ error: 'Fechas inválidas: el fin debe ser después del inicio' });
    }

    const existente = await PromoCode.findOne({ codigo: codigo.trim().toUpperCase() });
    if (existente) {
      return res.status(409).json({ error: 'Ya existe un código con ese nombre' });
    }

    const promo = await PromoCode.create({
      codigo: codigo.trim().toUpperCase(),
      porcentaje: pct,
      usosMaximos: usos,
      vigenciaInicio: inicio,
      vigenciaFin: fin,
      creadoPor: req.user.email
    });

    res.status(201).json({ ok: true, promo });
  } catch (err) {
    console.error('Error al crear promo:', err.message);
    res.status(500).json({ error: 'Error al crear el código promocional' });
  }
});

router.patch('/:id', authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    const promo = await PromoCode.findById(req.params.id);
    if (!promo) return res.status(404).json({ error: 'Código no encontrado' });

    if (typeof req.body.activo === 'boolean') promo.activo = req.body.activo;
    if (req.body.porcentaje !== undefined) {
      const pct = Number(req.body.porcentaje);
      if (Number.isInteger(pct) && pct >= 1 && pct <= 100) promo.porcentaje = pct;
    }
    if (req.body.usosMaximos !== undefined) {
      const usos = Number(req.body.usosMaximos);
      if (Number.isInteger(usos) && usos >= 1) promo.usosMaximos = usos;
    }
    if (req.body.vigenciaFin) {
      const fin = new Date(req.body.vigenciaFin);
      if (!isNaN(fin)) promo.vigenciaFin = fin;
    }

    await promo.save();
    res.json({ ok: true, promo });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar el código' });
  }
});

router.delete('/:id', authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    const result = await PromoCode.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Código no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar el código' });
  }
});

// GET /api/admin/promos/validar/:codigo — público, para que el frontend
// pueda verificar un código sin auth
router.get('/validar/:codigo', async (req, res) => {
  try {
    const codigo = String(req.params.codigo).trim().toUpperCase();
    const promo = await PromoCode.findOne({ codigo });
    if (!promo || !promo.valido) {
      return res.json({ ok: false, error: 'Código no válido o expirado' });
    }
    res.json({ ok: true, porcentaje: promo.porcentaje, codigo: promo.codigo });
  } catch (err) {
    res.status(500).json({ error: 'Error al validar código' });
  }
});

export default router;
