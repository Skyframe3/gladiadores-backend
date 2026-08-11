import express from 'express';
import multer from 'multer';
import { put } from '@vercel/blob';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = express.Router();

// En memoria: la imagen nunca toca el disco del servidor, se sube
// directo a Vercel Blob y se olvida.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB por foto
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|avif|gif)$/.test(file.mimetype)) {
      return cb(new Error('Solo se aceptan imágenes (jpg, png, webp, avif, gif)'));
    }
    cb(null, true);
  }
});

// POST /api/admin/upload — sube una foto y regresa su URL pública
router.post('/', authMiddleware, adminMiddleware, (req, res) => {
  upload.single('foto')(req, res, async (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'La foto pesa más de 8 MB' : err.message;
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: 'No llegó ningún archivo' });
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('BLOB_READ_WRITE_TOKEN no configurado');
      return res.status(503).json({ error: 'Subida de fotos no disponible: falta configurar el almacenamiento' });
    }

    try {
      const nombreLimpio = req.file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_');
      const ruta = `rutas/${Date.now()}-${nombreLimpio}`;
      const blob = await put(ruta, req.file.buffer, {
        access: 'public',
        contentType: req.file.mimetype,
        token: process.env.BLOB_READ_WRITE_TOKEN
      });
      res.json({ ok: true, url: blob.url });
    } catch (e) {
      console.error('Error al subir a Blob:', e.message);
      res.status(500).json({ error: 'No se pudo subir la foto' });
    }
  });
});

export default router;
