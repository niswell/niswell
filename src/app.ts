import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from './middleware/auth';
import authRoutes from './routes/auth.routes';
import viewerProfileRoutes from './routes/viewer-profile.routes';
import creatorProfileRoutes from './routes/creator-profile.routes';
import paymentRoutes from './routes/payment.routes';
import streamRoutes from './routes/stream.routes';
import { AppError } from './utils/errors';

const app: Express = express();

// Trust proxy for rate limiting and IP detection
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Stripe webhook middleware (must be before json parser)
app.use(
  '/api/payments/webhooks/stripe',
  express.raw({ type: 'application/json' })
);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Global rate limiting
const rateLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000');
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');
app.use('/api/', rateLimit(rateLimitWindow, rateLimitMax));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );
  });

  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/profiles', viewerProfileRoutes);
app.use('/api/creator', creatorProfileRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/streams', streamRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      details: err.details,
    });
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      code: 'CORS_ERROR',
      message: 'CORS policy violation',
    });
  }

  console.error('Unhandled error:', err);

  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: err.message }),
  });
});

export default app;
