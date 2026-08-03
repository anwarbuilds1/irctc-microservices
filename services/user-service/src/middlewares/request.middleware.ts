import pinoHttp from 'pino-http';
import { logger } from '../config';

export const requestLoggerMiddleware = pinoHttp({
  logger,
  autoLogging: true,
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        query: req.query,
        ip: req.remoteAddress || req.headers['x-forwarded-for'],
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
    err(err) {
      return {
        type: err.type,
        message: err.message,
        stack: err.stack,
      };
    },
  },
  customSuccessMessage(req, res, responseTime) {
    return `${req.method} ${req.url} completed with status ${res.statusCode} in ${responseTime.toFixed(2)}ms`;
  },
  customErrorMessage(req, res, err) {
    return `${req.method} ${req.url} failed with status ${res.statusCode}: ${err.message}`;
  },
});
