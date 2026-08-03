import { Request, Response, NextFunction } from 'express';
import { logger } from '../config';
import { AppError } from '../utils/errors';

export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const isOperational = err instanceof AppError ? err.isOperational : false;
  
  if (isOperational) {
    logger.warn({ err }, err.message);
  } else {
    logger.error(err, 'Unhandled error occurred');
  }

  const statusCode = err instanceof AppError ? err.statusCode : (err.status || 500);
  const status = err instanceof AppError ? err.status : 'error';
  const message = err.message || 'Internal Server Error';
  const errors = err instanceof AppError ? err.errors : null;

  res.status(statusCode).json({
    success: false,
    status,
    message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
