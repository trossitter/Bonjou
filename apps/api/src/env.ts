import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const booleanEnv = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  return value;
}, z.boolean());

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  WHATSAPP_ENABLED: booleanEnv.default(false),
  WHATSAPP_VERIFY_TOKEN: z.string().default('change-me-local-verify-token'),
  WHATSAPP_ACCESS_TOKEN: z.string().optional().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
  WHATSAPP_GRAPH_VERSION: z.string().default('v21.0'),
  TRANSLATION_PROVIDER: z.enum(['mock', 'demo', 'openai']).default('mock'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().default('gpt-4.1-mini'),
  DASHBOARD_ACCESS_TOKEN: z.string().optional().default('')
});

export const env = schema.parse(process.env);
