import express from 'express';
import helmet from 'helmet';
import { config, logger } from './config';
import healthRouter from './routes/health.route';
import { corsMiddleware } from './middlewares/cors.middleware';
import { requestLoggerMiddleware } from './middlewares/request.middleware';
import { notFoundMiddleware } from './middlewares/not-found.middleware';
import { errorMiddleware } from './middlewares/error.middleware';

const app = express();

// Security Middlewares
app.use(helmet());
app.use(corsMiddleware);

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP Request Logging
app.use(requestLoggerMiddleware);

// Route handlers
app.use('/', healthRouter);
app.use('/api/v1', healthRouter);

// Fallback handlers
app.use(notFoundMiddleware);
app.use(errorMiddleware);

// Start server
const server = app.listen(config.PORT, () => {
    logger.info(`User Service started in ${config.NODE_ENV} mode on port ${config.PORT}
    Health Check: http://localhost:${config.PORT}/api/v1/health
    `);
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
