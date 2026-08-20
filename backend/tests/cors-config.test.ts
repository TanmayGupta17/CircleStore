import { describe, expect, it } from 'vitest';
import {
  PREVIEW_FRONTEND_ORIGIN,
  PRODUCTION_FRONTEND_ORIGIN,
  resolveCorsOrigins,
} from '../src/config/cors';

describe('resolveCorsOrigins', () => {
  it('always includes the canonical production frontend', () => {
    const origins = resolveCorsOrigins('https://obsolete-preview.vercel.app');

    expect(origins).toContain(PRODUCTION_FRONTEND_ORIGIN);
    expect(origins).toContain(PREVIEW_FRONTEND_ORIGIN);
  });

  it('parses, normalises and deduplicates configured origins', () => {
    expect(
      resolveCorsOrigins(
        ` http://localhost:3000/, ${PRODUCTION_FRONTEND_ORIGIN}, http://localhost:3000 `,
      ),
    ).toEqual([
      'http://localhost:3000',
      PRODUCTION_FRONTEND_ORIGIN,
      PREVIEW_FRONTEND_ORIGIN,
    ]);
  });

  it('allows local development when no value is configured', () => {
    expect(resolveCorsOrigins(undefined)).toEqual([
      'http://localhost:3000',
      PRODUCTION_FRONTEND_ORIGIN,
      PREVIEW_FRONTEND_ORIGIN,
    ]);
  });
});
