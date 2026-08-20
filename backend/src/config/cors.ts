/**
 * Stable browser origins owned by this deployment.
 *
 * Render environment variables can outlive a Vercel deployment URL. Keeping
 * the canonical production origin here as a fail-safe prevents an obsolete
 * dashboard value from making every browser request look like a network error.
 * Additional preview or local origins still come from CORS_ORIGINS.
 */
export const PRODUCTION_FRONTEND_ORIGIN = 'https://frontend-pi-vert-67.vercel.app';
export const PREVIEW_FRONTEND_ORIGIN =
  'https://frontend-ju5rffnsl-tanmaygupta17s-projects.vercel.app';

export function resolveCorsOrigins(configured: string | undefined): string[] {
  const values = (configured ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return Array.from(
    new Set([...values, PRODUCTION_FRONTEND_ORIGIN, PREVIEW_FRONTEND_ORIGIN]),
  );
}
