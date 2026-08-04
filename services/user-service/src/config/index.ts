import { env } from './env';
import { logger } from './logger';
import { redis } from './redis';
import { prisma } from './prisma';

export const config = {
  PORT: env.PORT,
  NODE_ENV: env.NODE_ENV,
  DATABASE_URL: env.DATABASE_URL,
  JWT_SECRET: env.JWT_SECRET,
  REDIS_URL: env.REDIS_URL,
  RABBITMQ_URL: env.RABBITMQ_URL,
  ALLOWED_ORIGINS: env.ALLOWED_ORIGINS,
  SERVICE_NAME: env.SERVICE_NAME,
};

export { logger, redis, prisma };

