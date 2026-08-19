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
import catalogoRouter from './routes/catalogo.js';
import disponibilidadRouter from './routes/disponibilidad.js';
import chatbotRouter from './routes/chatbot.js';
import agenteRouter from './routes/agente.js';
import uploadRouter from './routes/upload.js';
import promosRouter from './routes/promos.js';
import configRouter from './routes/config.js';
import { authMiddleware, adminMiddleware } from './middleware/auth.js';

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

// El login es el blanco preferido de la fuerza bruta: límite propio y estrecho.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                       // 10 intentos por IP cada 15 minutos
  message: { error: 'Demasiados intentos de acceso. Espera 15 minutos.' },
  skipSuccessfulRequests: true,  // no castiga a quien entra bien
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth/login', loginLimiter);

// El agente llama a la API de Anthropic, que cuesta dinero por token:
// un límite propio evita que alguien vacíe la cuenta a punta de mensajes.
const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,                         // 20 mensajes cada 5 minutos por IP
  message: { error: 'Muchos mensajes seguidos. Espera un momento.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/chatbot/mensaje', chatLimiter);

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

// Promesa de conexión cacheada: en serverless cada invocación reutiliza
// la misma promesa en vez de abrir conexiones nuevas o rechazar mientras conecta.
let connPromise = null;

function conectarMongo() {
  // 1 = conectado, nada que esperar
  if (mongoose.connection.readyState === 1) return Promise.resolve();

  if (!connPromise) {
    connPromise = mongoose.connect(process.env.MONGODB_URI, mongoOptions)
      .then(() => console.log('✅ MongoDB conectado'))
      .catch(err => {
        console.error('⚠️  MongoDB error:', err.message);
        connPromise = null; // permite reintentar en la siguiente request
        throw err;
      });
  }
  return connPromise;
}

// Arranca la conexión al cargar el módulo (no bloquea)
conectarMongo().catch(() => {});

// Middleware: toda ruta que use la base de datos espera la misma promesa
app.use(async (req, res, next) => {
  // Health check siempre pasa sin esperar
  if (req.path === '/api/health' || req.path === '/api/debug-mongo') return next();

  try {
    await conectarMongo();
    next();
  } catch (e) {
    res.status(503).json({ error: 'Base de datos no disponible' });
  }
});

// Rutas API
// Sonda de vida. No revela qué variables están configuradas ni el estado
// interno de la conexión: eso le sirve más a quien sondea que a nosotros.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Diagnóstico de conexión. Expone nombres de colecciones y estado interno,
// así que va detrás de autenticación de administrador.
app.get('/api/debug-mongo', authMiddleware, adminMiddleware, async (req, res) => {
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
app.use('/api/catalogo', catalogoRouter);
app.use('/api/reservas', reservasRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/disponibilidad', disponibilidadRouter);
app.use('/api/chatbot', chatbotRouter);
app.use('/api/admin/agente', agenteRouter);
app.use('/api/admin/upload', uploadRouter);
app.use('/api/admin/promos', promosRouter);
app.use('/api/config', configRouter);

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
