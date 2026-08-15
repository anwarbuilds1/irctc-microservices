import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import healthRouter from './routes/health.route';
import authRouter from './routes/auth.route';
import { corsMiddleware } from './middlewares/cors.middleware';
import { requestLoggerMiddleware } from './middlewares/request.middleware';
import { notFoundMiddleware } from './middlewares/not-found.middleware';
import { errorMiddleware } from './middlewares/error.middleware';
import { setupSwagger } from './config/swagger';

export const app = express();

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: false // Disable CSP specifically for swagger-ui assets
}));
app.use(corsMiddleware);

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// HTTP Request Logging
app.use(requestLoggerMiddleware);

// Route handlers
app.use('/', healthRouter);
app.use('/api/v1', healthRouter);
app.use('/api/v1/auth', authRouter);

// Swagger Documentation
setupSwagger(app);

// Fallback handlers
app.use(notFoundMiddleware);
app.use(errorMiddleware);
