const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();
const matchesRouter = require('./routes/matches');
const companyImagesRouter = require('./routes/companyImages');
const paymentsRouter = require('./routes/payments');
const consultantsRouter = require('./routes/consultants');
const { requestId } = require('./middleware/requestId');
const { metricsMiddleware } = require('./middleware/metrics');
const { logger } = require('./utils/logger');

console.log('[DEBUG] starting server bootstrap...');

const { connectDB } = require('./config/db');
const healthRouter = require('./routes/health');
const readyRouter = require('./routes/ready');
const companiesRouter = require('./routes/companies');
const partnersRouter = require('./routes/partners');
const buyersRouter = require('./routes/buyers');
const adminRouter = require('./routes/admin');
const insightsRouter = require('./routes/insights');
const metricsRouter = require('./routes/metrics');

const setupSwagger = require('./swagger');

const app = express();

// Security headers
app.use(helmet());
// Optional CSP (can affect Swagger UI and dev tools); enable via ENABLE_CSP=true
if (String(process.env.ENABLE_CSP || 'false').toLowerCase() === 'true') {
  app.use(
    helmet.contentSecurityPolicy({
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'http:', 'https:', 'ws:', 'wss:'],
      },
    })
  );
}

// ??��? ??????
// CORS (CORS_ORIGINS=comma-separated). fallback: allow all
const corsOrigins = (process.env.CORS_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const corsOptions = corsOrigins.includes('*')
  ? { origin: true }
  : {
    origin: function (origin, callback) {
      if (!origin || corsOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  };
app.use(cors(corsOptions));
app.use(express.json());

// Request ID & structured logging
app.use(requestId);
// HTTP metrics (counts + durations)
// app.use(metricsMiddleware);
morgan.token('id', (req) => req.id || '-');
app.use(
  morgan(':id :method :url :status :res[content-length] - :response-time ms', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);

// Rate limit (per minute)
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX || 120),
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Swagger UI (/docs)
setupSwagger(app);

// ?? ????
app.get('/', (req, res) => {
  res.send('K-Statra API is running.');
});

// ????? ??? (app ???? ???��? ???)
app.use('/health', healthRouter);
app.use('/ready', readyRouter);
app.use('/companies', companiesRouter);
app.use('/partners', partnersRouter);
app.use('/buyers', buyersRouter); // ???: buyers ???? ???
app.use('/matches', matchesRouter);
app.use('/companies/:companyId/images', companyImagesRouter);
app.use('/uploads', express.static(require('path').join(__dirname, '../uploads')));
app.use('/payments', paymentsRouter);
app.use('/consultants', consultantsRouter);
app.use('/admin', adminRouter);
app.use('/metrics', metricsRouter);
app.use('/analytics', insightsRouter);

const PORT = process.env.PORT || 4000;

// DB ???? ?? ???? ????(????)
// DB Connection with Retry Logic
const connectWithRetry = async (attempt = 1) => {
  try {
    const { logger } = require('./utils/logger');
    logger.info(`[bootstrap] calling connectDB (attempt ${attempt})`);
    await connectDB();
    logger.info('[bootstrap] DB connected');

    app.listen(PORT, () => {
      logger.info(`API Server listening at http://localhost:${PORT}`);
    });

    try {
      const { startPaymentPoller } = require('./services/paymentPoller');
      startPaymentPoller();
    } catch (err) {
      logger.warn(`[bootstrap] payment poller not started: ${err.message}`);
    }
  } catch (err) {
    const { logger } = require('./utils/logger');
    logger.error(`[bootstrap] DB connection failed: ${err.message}`);

    // Retry logic
    const retryDelay = Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30s
    logger.info(`[bootstrap] Retrying in ${retryDelay / 1000}s...`);

    setTimeout(() => {
      connectWithRetry(attempt + 1);
    }, retryDelay);
  }
};

connectWithRetry();

// Global Error Handlers
process.on('uncaughtException', (err) => {
  const { logger } = require('./utils/logger');
  logger.error('[FATAL] Uncaught Exception:', err);
  // Do NOT exit, just log. 
  // In a containerized env, you might want to exit, but user requested "don't close screen".
});

process.on('unhandledRejection', (reason, promise) => {
  const { logger } = require('./utils/logger');
  logger.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

// 404 Not Found handler (after all routes)
app.use((req, res) => {
  res.status(404).json({
    message: 'Not Found',
    path: req.originalUrl,
  });
});

// Global error handler
// Normalizes Joi and generic errors to a consistent JSON shape
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Joi validation error
  if (err && (err.isJoi || err.name === 'ValidationError') && err.details) {
    try {
      logger.warn('[validation]', {
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        details: (err.details || []).map((d) => ({ message: d.message, path: d.path })),
      });
    } catch (_) { }
    return res.status(400).json({
      message: 'Validation error',
      details: err.details.map((d) => ({ message: d.message, path: d.path })),
    });
  }

  const status = err.status || err.statusCode || 500;
  const payload = {
    message: err.message || 'Internal server error',
    requestId: req.id,
  };

  if (process.env.NODE_ENV !== 'production' && err && err.stack) {
    payload.stack = err.stack;
  }

  try {
    logger.error('[error]', {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      status,
      message: payload.message,
      stack: err && err.stack,
    });
  } catch (_) { }

  res.status(status).json(payload);
});









