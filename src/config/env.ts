import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('/api'),

  DATABASE_URL: z.string(),

  BUKAOLSHOP_API_URL: z.string().optional().default(''),
  BUKAOLSHOP_API_KEY: z.string().optional().default(''),
  BUKAOLSHOP_WEBHOOK_SECRET: z.string().optional().default(''),

  DIGIFLAZZ_USERNAME: z.string().optional().default(''),
  DIGIFLAZZ_API_KEY: z.string().optional().default(''),
  DIGIFLAZZ_BASE_URL: z.string().optional().default('https://api.digiflazz.com'),
  DIGIFLAZZ_WEBHOOK_SECRET: z.string().optional().default(''),

  PAYMENT_PROVIDER: z.string().optional().default(''),
  PAYMENT_API_URL: z.string().optional().default(''),
  PAYMENT_API_KEY: z.string().optional().default(''),
  PAYMENT_MERCHANT_ID: z.string().optional().default(''),
  PAYMENT_WEBHOOK_SECRET: z.string().optional().default(''),
  PAYMENT_CALLBACK_URL: z.string().optional().default(''),

  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  TELEGRAM_ADMIN_IDS: z.string().optional().default(''),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
