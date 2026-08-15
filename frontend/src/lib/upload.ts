import { api } from './api';
import type { SignedUpload, UploadCapabilities } from './types';

/**
 * Browser-side upload helper.
 *
 * The file goes directly from the browser to the storage provider; our API only
 * mints the signature. That keeps large multipart bodies out of the API process
 * entirely.
 */

export interface UploadedImage {
  url: string;
  storageKey: string;
  width: number | null;
  height: number | null;
}

export class UploadError extends Error {}

export function validateFile(file: File, capabilities: UploadCapabilities): string | null {
  if (!capabilities.allowedMimeTypes.includes(file.type)) {
    const readable = capabilities.allowedMimeTypes
      .map((type) => type.replace('image/', '').toUpperCase())
      .join(', ');
    return `${file.name} is not a supported image (allowed: ${readable}).`;
  }

  if (file.size > capabilities.maxBytes) {
    return `${file.name} is ${formatBytes(file.size)}; the limit is ${formatBytes(capabilities.maxBytes)}.`;
  }

  return null;
}

/**
 * Uploads one file and reports progress.
 *
 * `XMLHttpRequest` rather than `fetch` purely because it exposes upload
 * progress events, which `fetch` still does not.
 */
export async function uploadFile(
  file: File,
  draftId: string,
  onProgress?: (percent: number) => void,
): Promise<UploadedImage> {
  const signed: SignedUpload = await api.uploads.signature(draftId);

  const form = new FormData();
  for (const [key, value] of Object.entries(signed.fields)) {
    form.append(key, value);
  }
  form.append('file', file);

  const response = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', signed.uploadUrl);

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener('load', () => {
      try {
        const payload = JSON.parse(request.responseText) as Record<string, unknown>;
        if (request.status >= 200 && request.status < 300) {
          resolve(payload);
        } else {
          const error = payload.error as { message?: string } | undefined;
          reject(new UploadError(error?.message ?? `Upload failed (${request.status}).`));
        }
      } catch {
        reject(new UploadError('The storage provider returned an unreadable response.'));
      }
    });

    request.addEventListener('error', () => reject(new UploadError('Network error during upload.')));
    request.addEventListener('abort', () => reject(new UploadError('Upload cancelled.')));

    request.send(form);
  });

  const url = typeof response.secure_url === 'string' ? response.secure_url : null;
  const publicId = typeof response.public_id === 'string' ? response.public_id : null;

  if (!url || !publicId) {
    throw new UploadError('The storage provider did not return a usable image URL.');
  }

  return {
    url,
    storageKey: publicId,
    // Provided by the upload response, so no server-side image decoding is
    // needed to know the dimensions.
    width: typeof response.width === 'number' ? response.width : null,
    height: typeof response.height === 'number' ? response.height : null,
  };
}

/**
 * Rewrites a Cloudinary URL to request a derived size.
 *
 * One stored original serves every context: the card asks for a small WebP, the
 * PDP for a large one. `f_auto,q_auto` lets Cloudinary pick the best format and
 * quality per browser.
 */
export function cloudinaryVariant(url: string, transform = 'f_auto,q_auto'): string {
  if (!url.includes('/image/upload/')) return url;
  return url.replace('/image/upload/', `/image/upload/${transform}/`);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Stable per-draft id so an abandoned draft's uploads share one folder. */
export function createDraftId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
