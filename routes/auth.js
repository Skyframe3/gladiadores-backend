import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
// otplib 13 expone funciones sueltas; el objeto `authenticator` de las
// versiones anteriores ya no existe.
import { generateSecret, generateURI, verify as verificarOTP } from 'otplib';
import QRCode from 'qrcode';
import Admin from '../models/Admin.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Margen para el desfase entre el reloj del teléfono y el del servidor
const TOLERANCIA_SEG = 30;

const EMISOR = 'Gladiadores Off Road';
const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

const firmarSesion = (admin) =>
  jwt.sign(
    { id: admin._id, email: admin.email, role: admin.rol },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

// Token intermedio: solo sirve para canjear el código 2FA, no da acceso a nada
const firmarPaso2FA = (admin) =>
  jwt.sign(
    { id: admin._id, paso: '2fa' },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );

const generarCodigosRespaldo = () =>
  Array.from({ length: 8 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase().match(/.{4}/g).join('-')
  );

// POST /api/auth/login — paso 1: email y contraseña
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Exigir cadenas: si llega un objeto como {"$ne":null}, mongoose lo
    // interpretaría como operador de consulta y bcrypt reventaría con un 500.
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET no configurado');
      return res.status(500).json({ error: 'Error de configuración del servidor' });
    }

    const admin = await Admin.findOne({ email: String(email).toLowerCase() });

    // Mismo mensaje para usuario inexistente y contraseña mala:
    // decir cuál de los dos falló revela qué correos son válidos.
    if (!admin || !admin.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (admin.bloqueadoHasta && admin.bloqueadoHasta > new Date()) {
      const min = Math.ceil((admin.bloqueadoHasta - Date.now()) / 60000);
      return res.status(429).json({ error: `Cuenta bloqueada. Intenta en ${min} minutos.` });
    }

    const passwordValido = await admin.comparePassword(password);
    if (!passwordValido) {
      const intentos = (admin.intentosFallidos || 0) + 1;
      const cambios = { intentosFallidos: intentos };
      if (intentos >= MAX_INTENTOS) {
        cambios.bloqueadoHasta = new Date(Date.now() + BLOQUEO_MINUTOS * 60000);
        cambios.intentosFallidos = 0;
      }
      await Admin.updateOne({ _id: admin._id }, { $set: cambios });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    await Admin.updateOne(
      { _id: admin._id },
      { $set: { intentosFallidos: 0, bloqueadoHasta: null } }
    );

    // Con 2FA activo la sesión todavía no se entrega
    if (admin.totpActivo) {
      return res.json({ ok: true, requiere2FA: true, tempToken: firmarPaso2FA(admin) });
    }

    await Admin.updateOne({ _id: admin._id }, { $set: { ultimoAcceso: new Date() } });

    res.json({
      ok: true,
      token: firmarSesion(admin),
      admin: { id: admin._id, email: admin.email, nombre: admin.nombre, rol: admin.rol },
      avisos: { sin2FA: true }
    });
  } catch (err) {
    console.error('Error login:', err.message);
    res.status(500).json({ error: 'Error al autenticar' });
  }
});

// POST /api/auth/login/2fa — paso 2: código del autenticador o de respaldo
router.post('/login/2fa', async (req, res) => {
  try {
    const { tempToken, codigo } = req.body;
    if (!tempToken || !codigo) {
      return res.status(400).json({ error: 'Falta el código' });
    }

    let payload;
    try {
      payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'La sesión expiró, vuelve a iniciar' });
    }
    if (payload.paso !== '2fa') {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const admin = await Admin.findById(payload.id).select('+totpSecret +codigosRespaldo');
    if (!admin || !admin.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // El código son 6 dígitos contra un millón de combinaciones: sin un tope
    // de intentos, quien ya tenga la contraseña puede probarlas todas.
    if (admin.bloqueadoHasta && admin.bloqueadoHasta > new Date()) {
      const min = Math.ceil((admin.bloqueadoHasta - Date.now()) / 60000);
      return res.status(429).json({ error: `Cuenta bloqueada. Intenta en ${min} minutos.` });
    }

    const limpio = String(codigo).replace(/\s/g, '').toUpperCase();
    let valido = false;
    // Un TOTP son 6 dígitos; un código de respaldo tiene la forma XXXX-XXXX.
    // Separarlos evita gastar ocho comparaciones bcrypt en cada intento.
    const pareceTOTP = /^\d{6}$/.test(limpio);

    if (pareceTOTP && admin.totpSecret) {
      const r = await verificarOTP({
        secret: admin.totpSecret, token: limpio, epochTolerance: TOLERANCIA_SEG
      });
      valido = r.valid;
    }

    // Si no es un TOTP, puede ser un código de respaldo: se consume al usarlo
    if (!valido && !pareceTOTP && admin.codigosRespaldo?.length) {
      for (const hash of admin.codigosRespaldo) {
        if (await bcrypt.compare(limpio, hash)) {
          await Admin.updateOne({ _id: admin._id }, { $pull: { codigosRespaldo: hash } });
          valido = true;
          break;
        }
      }
    }

    if (!valido) {
      const intentos = (admin.intentosFallidos2FA || 0) + 1;
      const cambios = { intentosFallidos2FA: intentos };
      if (intentos >= MAX_INTENTOS) {
        // El bloqueo es de la cuenta, no del token: así tampoco puede
        // volver a /login a pedir un tempToken nuevo y seguir probando.
        cambios.bloqueadoHasta = new Date(Date.now() + BLOQUEO_MINUTOS * 60000);
        cambios.intentosFallidos2FA = 0;
      }
      await Admin.updateOne({ _id: admin._id }, { $set: cambios });
      return res.status(401).json({ error: 'Código incorrecto' });
    }

    await Admin.updateOne(
      { _id: admin._id },
      { $set: { intentosFallidos2FA: 0, bloqueadoHasta: null, ultimoAcceso: new Date() } }
    );

    res.json({
      ok: true,
      token: firmarSesion(admin),
      admin: { id: admin._id, email: admin.email, nombre: admin.nombre, rol: admin.rol }
    });
  } catch (err) {
    console.error('Error 2FA:', err.message);
    res.status(500).json({ error: 'Error al verificar el código' });
  }
});

// POST /api/auth/2fa/preparar — genera el secreto y el QR para escanear
router.post('/2fa/preparar', authMiddleware, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (admin.totpActivo) {
      return res.status(400).json({ error: 'El segundo factor ya está activo' });
    }

    const secret = generateSecret();
    // Se guarda pero sigue inactivo hasta que confirme un código válido
    await Admin.updateOne({ _id: admin._id }, { $set: { totpSecret: secret } });

    const otpauth = generateURI({ secret, label: admin.email, issuer: EMISOR });
    const qr = await QRCode.toDataURL(otpauth, { margin: 1, width: 260 });

    res.json({ ok: true, qr, secret, emisor: EMISOR });
  } catch (err) {
    console.error('Error preparando 2FA:', err.message);
    res.status(500).json({ error: 'Error al preparar el segundo factor' });
  }
});

// POST /api/auth/2fa/activar — confirma con un código y entrega los de respaldo
router.post('/2fa/activar', authMiddleware, async (req, res) => {
  try {
    const { codigo } = req.body;
    if (!codigo) return res.status(400).json({ error: 'Falta el código' });

    const admin = await Admin.findById(req.user.id).select('+totpSecret');
    if (!admin?.totpSecret) {
      return res.status(400).json({ error: 'Primero genera el código QR' });
    }

    const { valid } = await verificarOTP({
      secret: admin.totpSecret,
      token: String(codigo).replace(/\s/g, ''),
      epochTolerance: TOLERANCIA_SEG
    });
    if (!valid) return res.status(401).json({ error: 'Código incorrecto' });

    const codigos = generarCodigosRespaldo();
    const hashes = await Promise.all(codigos.map(c => bcrypt.hash(c, 10)));

    await Admin.updateOne(
      { _id: admin._id },
      { $set: { totpActivo: true, codigosRespaldo: hashes } }
    );

    // Única vez que los códigos se ven en claro
    res.json({ ok: true, codigosRespaldo: codigos });
  } catch (err) {
    console.error('Error activando 2FA:', err.message);
    res.status(500).json({ error: 'Error al activar el segundo factor' });
  }
});

// POST /api/auth/2fa/desactivar — exige la contraseña para evitar que
// una sesión robada apague la protección
router.post('/2fa/desactivar', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Confirma tu contraseña' });

    const admin = await Admin.findById(req.user.id);
    if (!admin) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (!(await admin.comparePassword(password))) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    await Admin.updateOne(
      { _id: admin._id },
      { $set: { totpActivo: false, totpSecret: null, codigosRespaldo: [] } }
    );

    res.json({ ok: true, mensaje: 'Segundo factor desactivado' });
  } catch (err) {
    console.error('Error desactivando 2FA:', err.message);
    res.status(500).json({ error: 'Error al desactivar el segundo factor' });
  }
});

// GET /api/auth/verify — estado de la sesión actual
router.get('/verify', authMiddleware, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin || !admin.activo) {
      return res.status(401).json({ ok: false, error: 'Sesión inválida' });
    }
    res.json({
      ok: true,
      admin: {
        id: admin._id, email: admin.email, nombre: admin.nombre,
        rol: admin.rol, totpActivo: admin.totpActivo
      }
    });
  } catch {
    res.status(401).json({ ok: false, error: 'Token inválido' });
  }
});

export default router;
