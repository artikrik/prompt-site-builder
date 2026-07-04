import { z } from 'zod';

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),

  // LLM APIs
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().optional(),
  MIMO_API_KEY: z.string().optional(),
  MIMO_BASE_URL: z.string().optional(),
  MIMO_MODEL: z.string().optional(),
  LLM_PROVIDER: z.enum(['anthropic', 'openai', 'deepseek', 'mimo']).default('openai'),

  // Image Generation
  IMAGE_PROVIDER: z.enum(['dall-e-3']).default('dall-e-3'),
  DALL_E_MODEL: z.string().default('dall-e-3'),

  // Scraper
  APIFY_TOKEN: z.string().min(1),

  // Publishing
  HUGO_SITES_PATH: z.string().default('/var/www/client-sites'),
  HUGO_BINARY_PATH: z.string().default('hugo'),

  // Domain
  BASE_DOMAIN: z.string().default('sitenow.pp.ua'),

  // Widgets
  EASYWEEK_API_KEY: z.string().optional(),
  WAYFORPAY_MERCHANT: z.string().optional(),
  WAYFORPAY_SECRET: z.string().optional(),
  MONOBANK_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}
