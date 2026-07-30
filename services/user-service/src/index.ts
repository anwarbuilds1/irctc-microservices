import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import healthRouter from './routes/health.route';
import { notFoundMiddleware } from './middlewares/not-found.middleware';
import { errorMiddleware } from './middlewares/error.middleware';

const app = express();

// Security Middlewares
app.use(helmet());
app.use(
  cors({
    origin: env.ALLOWED_ORIGINS === '*' ? '*' : env.ALLOWED_ORIGINS.split(','),
    credentials: true,
  })
);

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP Request Logging
app.use(pinoHttp({ logger }));

// Route handlers
app.use('/', healthRouter);
app.use('/api/v1', healthRouter);

// Fallback handlers
app.use(notFoundMiddleware);
app.use(errorMiddleware);

// Start server
const server = app.listen(env.PORT, () => {
  logger.info(`🚀 User Service started in ${env.NODE_ENV} mode on port ${env.PORT}`);
});

// Graceful shutdown
const shutdown = () => {
  logger.info('Shutting down gracefully...');
  server.close(() => {
    logger.info('Closed out remaining connections.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
