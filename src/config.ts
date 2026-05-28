import 'dotenv/config';
import { z } from 'zod';
import type { AppConfig } from './types.js';

const optionalNumber = z
  .string()
  .optional()
  .transform((value) => {
    if (!value) {
      return undefined;
    }
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  });

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  PUBLIC_APP_URL: z.string().url(),
  BIGCOMMERCE_CLIENT_ID: z.string().min(1),
  BIGCOMMERCE_CLIENT_SECRET: z.string().min(1),
  BIGCOMMERCE_JWT_SECRET: z.string().min(1),
  MAKEPAY_BASE_URL: z.string().url().default('https://www.makecrypto.io'),
  MAKEPAY_KEY_ID: z.string().min(1),
  MAKEPAY_KEY_SECRET: z.string().min(1),
  MAKEPAY_WEBHOOK_SECRET: z.string().min(1),
  ADMIN_TOKEN: z.string().min(16),
  BIGCOMMERCE_PENDING_STATUS_ID: optionalNumber,
  BIGCOMMERCE_PAID_STATUS_ID: optionalNumber,
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);

  return {
    port: parsed.PORT,
    publicAppUrl: parsed.PUBLIC_APP_URL.replace(/\/+$/, ''),
    bigCommerceClientId: parsed.BIGCOMMERCE_CLIENT_ID,
    bigCommerceClientSecret: parsed.BIGCOMMERCE_CLIENT_SECRET,
    bigCommerceJwtSecret: parsed.BIGCOMMERCE_JWT_SECRET,
    makePayBaseUrl: parsed.MAKEPAY_BASE_URL.replace(/\/+$/, ''),
    makePayKeyId: parsed.MAKEPAY_KEY_ID,
    makePayKeySecret: parsed.MAKEPAY_KEY_SECRET,
    makePayWebhookSecret: parsed.MAKEPAY_WEBHOOK_SECRET,
    adminToken: parsed.ADMIN_TOKEN,
    pendingStatusId: parsed.BIGCOMMERCE_PENDING_STATUS_ID,
    paidStatusId: parsed.BIGCOMMERCE_PAID_STATUS_ID,
  };
}
