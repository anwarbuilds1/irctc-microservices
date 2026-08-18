import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().default('your-secret-key-for-irctc-user-service'),
  REDIS_URL: z.string().optional(),
  RABBITMQ_URL: z.string().optional(),
  ALLOWED_ORIGINS: z.string().default('*'),
  SERVICE_NAME: z.string().default('user-service'),
  RESEND_API_KEY: z.string().optional().default('re_mock_key'),
  RESEND_FROM_EMAIL: z.string().default('onboarding@resend.dev'),
  GOOGLE_CLIENT_ID: z.string().optional().default('mock-google-client-id'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
