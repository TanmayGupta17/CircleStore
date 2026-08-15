import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CloudinaryProvider } from '../src/storage/cloudinary.provider';
import { UnconfiguredStorageProvider } from '../src/storage/storage-provider';
import { UploadService } from '../src/services/upload.service';
import { NotConfiguredError } from '../src/core/errors';

const CONFIG = {
  cloudName: 'demo-cloud',
  apiKey: '123456789012345',
  apiSecret: 'test-secret',
  uploadPreset: '',
};

const POLICY = {
  maxBytes: 5 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/webp'],
  folder: 'circlestore/listings',
};

/** Cloudinary's scheme: sorted `k=v&k=v`, append the secret, SHA-1. */
function expectedSignature(params: Record<string, string | number>, secret: string): string {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1').update(canonical + secret).digest('hex');
}

describe('CloudinaryProvider', () => {
  it('signs exactly the parameters it sends', () => {
    const provider = new CloudinaryProvider(CONFIG);
    const signed = provider.createSignedUpload({ folder: 'circlestore/listings/abc' });

    const timestamp = Number(signed.fields.timestamp);
    expect(Number.isFinite(timestamp)).toBe(true);

    expect(signed.fields.signature).toBe(
      expectedSignature({ folder: 'circlestore/listings/abc', timestamp }, CONFIG.apiSecret),
    );
  });

  it('includes the upload preset in the signature when one is configured', () => {
    const provider = new CloudinaryProvider({ ...CONFIG, uploadPreset: 'listings_signed' });
    const signed = provider.createSignedUpload({ folder: 'f' });
    const timestamp = Number(signed.fields.timestamp);

    expect(signed.fields.upload_preset).toBe('listings_signed');
    expect(signed.fields.signature).toBe(
      expectedSignature(
        { folder: 'f', timestamp, upload_preset: 'listings_signed' },
        CONFIG.apiSecret,
      ),
    );
  });

  it('never exposes the API secret to the client', () => {
    const provider = new CloudinaryProvider(CONFIG);
    const signed = provider.createSignedUpload({ folder: 'f' });

    expect(JSON.stringify(signed)).not.toContain(CONFIG.apiSecret);
  });

  it('targets the configured cloud', () => {
    const signed = new CloudinaryProvider(CONFIG).createSignedUpload({ folder: 'f' });
    expect(signed.uploadUrl).toBe('https://api.cloudinary.com/v1_1/demo-cloud/image/upload');
  });

  it('reports itself unconfigured when any credential is missing', () => {
    expect(new CloudinaryProvider({ ...CONFIG, cloudName: '' }).isConfigured).toBe(false);
    expect(new CloudinaryProvider({ ...CONFIG, apiKey: '' }).isConfigured).toBe(false);
    expect(new CloudinaryProvider({ ...CONFIG, apiSecret: '' }).isConfigured).toBe(false);
    expect(new CloudinaryProvider(CONFIG).isConfigured).toBe(true);
  });
});

describe('UploadService', () => {
  it('refuses to sign when no provider is configured', () => {
    const service = new UploadService(new UnconfiguredStorageProvider(), POLICY);

    expect(service.getCapabilities().enabled).toBe(false);
    expect(() => service.createSignedUpload('draft')).toThrow(NotConfiguredError);
  });

  it('namespaces uploads by draft so orphans stay sweepable', () => {
    const service = new UploadService(new CloudinaryProvider(CONFIG), POLICY);
    expect(service.createSignedUpload('abc123').folder).toBe('circlestore/listings/abc123');
  });

  it('strips path traversal out of a client-supplied draft id', () => {
    const service = new UploadService(new CloudinaryProvider(CONFIG), POLICY);

    // A client must not be able to escape the listings folder.
    expect(service.createSignedUpload('../../evil').folder).toBe('circlestore/listings/evil');
    expect(service.createSignedUpload('a/b/c').folder).toBe('circlestore/listings/abc');
  });

  it('falls back to a safe segment when the draft id is entirely invalid', () => {
    const service = new UploadService(new CloudinaryProvider(CONFIG), POLICY);
    expect(service.createSignedUpload('///').folder).toBe('circlestore/listings/misc');
  });

  it('swallows storage delete failures rather than failing the caller', async () => {
    const exploding = {
      name: 'exploding',
      isConfigured: true,
      createSignedUpload: () => {
        throw new Error('unused');
      },
      delete: async () => {
        throw new Error('provider is down');
      },
    };

    const service = new UploadService(exploding, POLICY);

    // A stray remote file is a smaller problem than failing the user's request.
    await expect(service.safeDelete('some-key')).resolves.toBeUndefined();
  });
});
