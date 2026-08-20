import 'dotenv/config';
import { resolveCorsOrigins } from './cors';

/**
 * Single place where `process.env` is read. Everything else receives typed
 * config, so no module deep in the stack reaches for an environment variable.
 */

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: optionalInt('PORT', 4000),
  databaseUrl: required('DATABASE_URL'),

  /** Comma-separated list of allowed browser origins. */
  corsOrigins: resolveCorsOrigins(process.env.CORS_ORIGINS),

  /**
   * No auth in this build — every listing is attributed to this seller.
   * See README "Out of scope" for what a real implementation would replace.
   */
  demoSeller: {
    id: process.env.DEMO_SELLER_ID ?? 'demo-seller',
    name: process.env.DEMO_SELLER_NAME ?? 'Demo Seller',
  },

  /**
   * Image storage. All three values are required for uploads to work; when any
   * is missing the app degrades gracefully to pasted image URLs rather than
   * failing to boot, so the project still runs with no Cloudinary account.
   */
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
    /** Optional signed upload preset carrying size/format restrictions. */
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET ?? '',
    folder: process.env.CLOUDINARY_FOLDER ?? 'circlestore/listings',
  },

  uploads: {
    maxBytes: optionalInt('UPLOAD_MAX_BYTES', 5 * 1024 * 1024),
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  },
} as const;

export const isProduction = env.nodeEnv === 'production';
