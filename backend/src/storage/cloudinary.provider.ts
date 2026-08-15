import { createHash } from 'node:crypto';
import type { SignedUpload, StorageProvider } from './storage-provider';

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  /** Optional signed upload preset carrying size/format restrictions. */
  uploadPreset: string;
}

/** Signed uploads are valid for this long; long enough for a slow connection. */
const SIGNATURE_TTL_SECONDS = 60 * 10;

/**
 * Cloudinary storage provider.
 *
 * Implemented against the REST API with `node:crypto` rather than pulling in the
 * Cloudinary SDK: signing is a sorted-parameter SHA-1, and avoiding the
 * dependency keeps the provider small and the swap-out cost honest.
 *
 * Cloudinary is a good fit here because its upload response returns exactly what
 * `listing_images` stores — `secure_url`, `public_id` (our `storage_key`),
 * `width` and `height` — so no server-side image decoding is ever needed.
 */
export class CloudinaryProvider implements StorageProvider {
  readonly name = 'cloudinary';

  constructor(private readonly config: CloudinaryConfig) {}

  get isConfigured(): boolean {
    return Boolean(this.config.cloudName && this.config.apiKey && this.config.apiSecret);
  }

  createSignedUpload({ folder }: { folder: string }): SignedUpload {
    const timestamp = Math.floor(Date.now() / 1000);

    // Only these params are signed; Cloudinary rejects the upload if the client
    // alters any of them, which is what stops arbitrary writes to the account.
    const signedParams: Record<string, string | number> = { folder, timestamp };
    if (this.config.uploadPreset) signedParams.upload_preset = this.config.uploadPreset;

    const signature = this.sign(signedParams);

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.config.cloudName}/image/upload`,
      fields: {
        api_key: this.config.apiKey,
        timestamp: String(timestamp),
        signature,
        folder,
        ...(this.config.uploadPreset ? { upload_preset: this.config.uploadPreset } : {}),
      },
      folder,
      expiresAt: new Date((timestamp + SIGNATURE_TTL_SECONDS) * 1000).toISOString(),
    };
  }

  async delete(storageKey: string): Promise<void> {
    if (!this.isConfigured || !storageKey) return;

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.sign({ public_id: storageKey, timestamp });

    const body = new URLSearchParams({
      public_id: storageKey,
      timestamp: String(timestamp),
      api_key: this.config.apiKey,
      signature,
    });

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.config.cloudName}/image/destroy`,
      { method: 'POST', body },
    );

    if (!response.ok) {
      throw new Error(`Cloudinary delete failed for "${storageKey}" (${response.status}).`);
    }
  }

  /**
   * Cloudinary's signing scheme: sort the params by key, join as `k=v&k=v`,
   * append the API secret, then SHA-1 the result.
   */
  private sign(params: Record<string, string | number>): string {
    const canonical = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    return createHash('sha1').update(canonical + this.config.apiSecret).digest('hex');
  }
}
