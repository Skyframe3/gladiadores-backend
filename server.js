import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import reservasRouter from './routes/reservas.js';
import authRouter from './routes/auth.js';

dotenv.config();

const app = express();

// Seguridad: headers HTTP
app.use(helmet());

// CORS: permitir frontend de Vercel y desarrollo local
app.use(cors({
  origin: [
    'https://deploy-gladiadores.vercel.app',
    'https://gladiadoresoffroad.com',
    'https://www.gladiadoresoffroad.com',
    'http://localhost:3000',
    'http://localhost:8080'
  ],
  credentials: true
}));

// Rate limiting: prevenir abuso
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP
  message: 'Demasiadas solicitudes, intenta más tarde',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Más estricto para crear reservas (prevenir scraping/spam)
const postLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // máximo 5 POST por minuto
  message: 'Límite de creación de reservas excedido',
  skipSuccessfulRequests: false
});
app.use('/api/reservas', (req, res, next) => {
  if (req.method === 'POST') return postLimiter(req, res, next);
  next();
});

app.use(express.json({ limit: '100kb' }));

// Conexion a MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error MongoDB:', err));

// Rutas API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/reservas', reservasRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Error handler (no exponer detalles sensibles)
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'development' ? err.message : 'Error interno del servidor';
  res.status(status).json({ error: message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});

export default app;
