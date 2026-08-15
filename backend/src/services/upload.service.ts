import { NotConfiguredError } from '../core/errors';
import type { SignedUpload, StorageProvider } from '../storage/storage-provider';

export interface UploadCapabilities {
  enabled: boolean;
  provider: string;
  maxBytes: number;
  allowedMimeTypes: readonly string[];
}

export interface UploadPolicy {
  maxBytes: number;
  allowedMimeTypes: readonly string[];
  /** Root folder assets are written under. */
  folder: string;
}

/**
 * Mints short-lived credentials so the browser can upload directly to the
 * storage provider.
 *
 * Note what this service does NOT do: receive files. Bytes never enter the API
 * process. Its only job is to decide *where* an asset may be written and to
 * authorise that narrowly.
 */
export class UploadService {
  constructor(
    private readonly storage: StorageProvider,
    private readonly policy: UploadPolicy,
  ) {}

  /** Advertised to the client so the sell flow can fall back to pasted URLs. */
  getCapabilities(): UploadCapabilities {
    return {
      enabled: this.storage.isConfigured,
      provider: this.storage.name,
      maxBytes: this.policy.maxBytes,
      allowedMimeTypes: this.policy.allowedMimeTypes,
    };
  }

  /**
   * Assets are namespaced by the client's draft id.
   *
   * Uploads necessarily happen before the listing exists, so abandoned drafts
   * leave orphans. Keying by draft makes them identifiable by prefix and
   * therefore sweepable later — see README "Out of scope".
   */
  createSignedUpload(draftId: string): SignedUpload {
    if (!this.storage.isConfigured) {
      throw new NotConfiguredError(
        'Image uploads are not configured. Set the Cloudinary environment variables, or paste image URLs instead.',
      );
    }

    return this.storage.createSignedUpload({
      folder: `${this.policy.folder}/${sanitiseSegment(draftId)}`,
    });
  }

  /**
   * Best effort: a failed remote delete must never fail the caller's request.
   * A stray file costs storage; a rolled-back transaction costs the user's work.
   */
  async safeDelete(storageKey: string | null | undefined): Promise<void> {
    if (!storageKey) return;

    try {
      await this.storage.delete(storageKey);
    } catch (error) {
      console.warn(`[storage] could not delete "${storageKey}":`, error);
    }
  }
}

/** Keeps a client-supplied id from escaping its folder. */
function sanitiseSegment(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  return cleaned || 'misc';
}
