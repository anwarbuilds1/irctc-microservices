import "dotenv/config";

export const env = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "*",
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:password@postgres:5432/user_db",
  JWT_SECRET: process.env.JWT_SECRET || "your-secret",
  REDIS_URL: process.env.REDIS_URL || "redis://redis:6379",
  RABBITMQ_URL: process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672",
};


