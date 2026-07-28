import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import reservasRouter from './routes/reservas.js';
import authRouter from './routes/auth.js';
import webhooksRouter from './routes/webhooks.js';
import checkoutRouter from './routes/checkout.js';

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

// Conexión a MongoDB con connection pooling para Vercel serverless
// NO bloquea el startup
const mongoOptions = {
  serverSelectionTimeoutMS: 60000,
  socketTimeoutMS: 60000,
  connectTimeoutMS: 30000,
  maxPoolSize: 3,  // Vercel serverless = pocas conexiones concurrentes
  minPoolSize: 1
};

// Intenta conectar en background (non-blocking)
if (mongoose.connection.readyState === 0) {
  mongoose.connect(process.env.MONGODB_URI, mongoOptions)
    .then(() => console.log('✅ MongoDB conectado'))
    .catch(err => console.error('⚠️  MongoDB error:', err.message));
}

// Middleware: espera conexión SOLO si está desconectado (máx 60s)
app.use(async (req, res, next) => {
  // Health check siempre pasa sin esperar
  if (req.path === '/api/health' || req.path === '/api/debug-mongo') return next();

  // Si ya está conectado, procede
  if (mongoose.connection.readyState === 1) return next();

  // Si está desconectado, intenta conectar UNA VEZ
  if (mongoose.connection.readyState === 0) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, mongoOptions);
    } catch (e) {
      console.error('MongoDB connection error:', e.message);
      return res.status(503).json({ error: 'Base de datos no disponible' });
    }
  }

  // Si sigue desconectado/conectando, rechaza
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Base de datos no disponible' });
  }

  next();
});

// Rutas API
app.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), v: 5, jwt: !!process.env.JWT_SECRET, db: !!process.env.MONGODB_URI, dbState: mongoose.connection.readyState });
});

app.get('/api/debug-mongo', async (req, res) => {
  try {
    const state = mongoose.connection.readyState;
    // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    const stateLabel = ['disconnected', 'connected', 'connecting', 'disconnecting'][state];

    if (state === 0) {
      console.log('Attempting to connect...');
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000
      });
    }

    const admin = await mongoose.connection.db.admin();
    const ping = await admin.ping();
    const collections = await mongoose.connection.db.listCollections().toArray();

    res.json({
      ok: true,
      readyState: mongoose.connection.readyState,
      readyStateLabel: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState],
      ping: !!ping,
      collections: collections.map(c => c.name),
      uri: process.env.MONGODB_URI ? '✅ configurada' : '❌ no configurada'
    });
  } catch (e) {
    res.status(500).json({
      error: e.message,
      readyState: mongoose.connection.readyState,
      readyStateLabel: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState],
      uri: process.env.MONGODB_URI ? '✅ configurada' : '❌ no configurada'
    });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/reservas', reservasRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/webhooks', webhooksRouter);

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
