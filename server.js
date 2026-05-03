const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const pool = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3001;

/* =========================
   MIDDLEWARES GENERALES
========================= */

app.use(helmet({
  crossOriginResourcePolicy: false
}));

app.use(compression());

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS bloqueado para el origen: ${origin}`));
  },
  credentials: true
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* =========================
   RATE LIMIT
========================= */

const limiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 15) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});

app.use('/api/', limiter);

/* =========================
   ARCHIVOS ESTÁTICOS
========================= */

app.use('/uploads', express.static('uploads'));

/* =========================
   RUTAS BASE
========================= */

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Backend Hotel Oasis Resort funcionando correctamente',
    status: 'OK',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS fecha_servidor');

    res.status(200).json({
      status: 'OK',
      database: 'connected',
      timestamp: new Date().toISOString(),
      db_time: result.rows[0].fecha_servidor,
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      database: 'disconnected',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/* =========================
   API ROUTES
========================= */

app.use('/api/auth', require('./routes/auth'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/services', require('./routes/services'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/events', require('./routes/events'));
app.use('/api/gallery', require('./routes/gallery'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/users', require('./routes/users'));

/* =========================
   MANEJO DE RUTAS NO EXISTENTES
========================= */

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

/* =========================
   MANEJO GLOBAL DE ERRORES
========================= */

app.use((err, req, res, next) => {
  console.error('Error:', err.stack || err.message);

  if (err.message && err.message.includes('CORS bloqueado')) {
    return res.status(403).json({
      error: 'CORS Error',
      message: err.message
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message
    });
  }

  if (err.code === '23505') {
    return res.status(409).json({
      error: 'Duplicate Entry',
      message: 'Ya existe un registro con esos datos.'
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      error: 'Reference Error',
      message: 'El registro relacionado no existe.'
    });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development'
      ? err.message
      : 'Something went wrong'
  });
});

/* =========================
   CIERRE CORRECTO DEL SERVIDOR
========================= */

process.on('SIGTERM', () => {
  console.log('SIGTERM recibido, cerrando servidor...');
  pool.end(() => {
    console.log('Pool de PostgreSQL cerrado.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT recibido, cerrando servidor...');
  pool.end(() => {
    console.log('Pool de PostgreSQL cerrado.');
    process.exit(0);
  });
});

/* =========================
   INICIO DEL SERVIDOR
========================= */

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Frontend permitido: ${process.env.FRONTEND_URL || 'No configurado'}`);
});

module.exports = app;
