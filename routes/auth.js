import express from 'express';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

const router = express.Router();

// POST /api/auth/login — Login de admin
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (!admin.activo) {
      return res.status(401).json({ error: 'Usuario desactivado' });
    }

    const passwordValido = await admin.comparePassword(password);
    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Actualizar último acceso
    admin.ultimoAcceso = new Date();
    await admin.save();

    // Generar JWT token
    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: admin.rol },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      ok: true,
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        nombre: admin.nombre,
        rol: admin.rol
      }
    });
  } catch (err) {
    console.error('Error login:', err);
    res.status(500).json({ error: 'Error al autenticar' });
  }
});

// POST /api/auth/register — Crear nuevo admin (solo owner puede hacer esto)
router.post('/register', async (req, res) => {
  try {
    const { email, password, nombre, rol, adminSecret } = req.body;

    // Solo se puede registrar si se proporciona el secreto correcto (para evitar spam)
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    if (!email || !password || !nombre) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    // Verificar que el email no exista
    const existente = await Admin.findOne({ email: email.toLowerCase() });
    if (existente) {
      return res.status(400).json({ error: 'Email ya registrado' });
    }

    // Crear nuevo admin
    const nuevoAdmin = new Admin({
      email: email.toLowerCase(),
      passwordHash: password,
      nombre,
      rol: rol || 'manager'
    });

    await nuevoAdmin.save();

    res.status(201).json({
      ok: true,
      admin: {
        id: nuevoAdmin._id,
        email: nuevoAdmin.email,
        nombre: nuevoAdmin.nombre,
        rol: nuevoAdmin.rol
      }
    });
  } catch (err) {
    console.error('Error register:', err);
    res.status(500).json({ error: 'Error al registrar admin' });
  }
});

// GET /api/auth/verify — Verificar token JWT
router.get('/verify', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Token requerido' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ ok: true, admin: decoded });
  } catch (err) {
    res.status(401).json({ ok: false, error: 'Token inválido' });
  }
});

export default router;
