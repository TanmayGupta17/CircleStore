/**
 * Image storage abstraction.
 *
 * The application never handles image bytes: the browser uploads straight to
 * the provider using short-lived credentials minted here. That keeps large
 * multipart bodies out of the API process entirely — no memory pressure, no
 * request-size limits, no timeouts on a slow mobile upload.
 *
 * Services depend on this interface, never on a specific vendor, so swapping
 * Cloudinary for S3/R2/Supabase is one new file plus one line in the container.
 */

/** Everything the browser needs to POST a file directly to the provider. */
export interface SignedUpload {
  /** Endpoint the browser posts its multipart form to. */
  uploadUrl: string;
  /** Fields that must accompany the file, verbatim. */
  fields: Record<string, string>;
  /** Where the asset will land, useful for later cleanup by prefix. */
  folder: string;
  expiresAt: string;
}

/** Normalised result the client reports back after a successful upload. */
export interface UploadedAsset {
  url: string;
  storageKey: string;
  width: number | null;
  height: number | null;
}

export interface StorageProvider {
  readonly name: string;

  /**
   * False when credentials are absent. The API advertises this so the sell flow
   * can fall back to pasted URLs instead of showing an upload box that cannot work.
   */
  readonly isConfigured: boolean;

  createSignedUpload(input: { folder: string }): SignedUpload;

  /**
   * Best-effort removal. Callers must treat failure as non-fatal: a stray file
   * is a smaller problem than rolling back a successful database write.
   */
  delete(storageKey: string): Promise<void>;
}

/**
 * Used when no provider is configured.
 *
 * Deliberately not a throwing stub at construction time — the app must still
 * boot and serve everything else, which is what keeps `npm run dev` working for
 * anyone who clones the repo without a Cloudinary account.
 */
export class UnconfiguredStorageProvider implements StorageProvider {
  readonly name = 'unconfigured';
  readonly isConfigured = false;

  createSignedUpload(): SignedUpload {
    throw new Error('No image storage provider is configured.');
  }

  async delete(): Promise<void> {
    // Nothing was ever stored by this provider.
  }
}
