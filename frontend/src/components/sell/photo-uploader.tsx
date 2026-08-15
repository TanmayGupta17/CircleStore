'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Input } from '@/components/ui';
import { api } from '@/lib/api';
import type { UploadCapabilities } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatBytes, uploadFile, validateFile } from '@/lib/upload';
import type { ImageDraft } from './steps';

interface PendingUpload {
  id: string;
  name: string;
  percent: number;
}

/**
 * Photo step.
 *
 * Files go straight from the browser to the storage provider using a
 * short-lived signature minted by our API — image bytes never pass through the
 * backend. The provider's response carries the URL, its own handle for the
 * asset, and the dimensions, which is exactly what `listing_images` stores.
 *
 * When storage is not configured the component degrades to pasting URLs, so the
 * project still works for anyone cloning it without a Cloudinary account.
 */
export function PhotosStep({
  images,
  draftId,
  onChange,
}: {
  images: ImageDraft[];
  draftId: string;
  onChange: (images: ImageDraft[]) => void;
}) {
  const [capabilities, setCapabilities] = useState<UploadCapabilities | null>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    api.uploads
      .capabilities()
      .then((result) => {
        if (!cancelled) setCapabilities(result);
      })
      .catch(() => {
        // Treat an unreachable capabilities endpoint as "uploads unavailable"
        // rather than blocking the step entirely.
        if (!cancelled) {
          setCapabilities({ enabled: false, provider: 'none', maxBytes: 0, allowedMimeTypes: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const remainingSlots = 10 - images.length - pending.length;

  const handleFiles = async (files: FileList | null) => {
    if (!files || !capabilities?.enabled) return;

    const selected = Array.from(files).slice(0, Math.max(remainingSlots, 0));
    const rejected: string[] = [];
    const accepted: File[] = [];

    for (const file of selected) {
      const problem = validateFile(file, capabilities);
      if (problem) rejected.push(problem);
      else accepted.push(file);
    }

    setErrors(rejected);

    // Uploads run concurrently; each reports its own progress.
    await Promise.all(
      accepted.map(async (file) => {
        const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`;
        setPending((previous) => [...previous, { id, name: file.name, percent: 0 }]);

        try {
          const uploaded = await uploadFile(file, draftId, (percent) => {
            setPending((previous) =>
              previous.map((item) => (item.id === id ? { ...item, percent } : item)),
            );
          });

          onChange([
            ...imagesRef.current,
            {
              url: uploaded.url,
              alt: '',
              storageKey: uploaded.storageKey,
              width: uploaded.width,
              height: uploaded.height,
            },
          ]);
        } catch (error) {
          setErrors((previous) => [
            ...previous,
            error instanceof Error ? error.message : `Could not upload ${file.name}.`,
          ]);
        } finally {
          setPending((previous) => previous.filter((item) => item.id !== id));
        }
      }),
    );
  };

  // Concurrent uploads each append to the list; a ref keeps them from
  // overwriting one another with a stale copy of `images`.
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const update = (index: number, patch: Partial<ImageDraft>) => {
    onChange(images.map((image, i) => (i === index ? { ...image, ...patch } : image)));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(target, 0, moved);
    onChange(next);
  };

  const uploadsEnabled = capabilities?.enabled ?? false;

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">Photos</h2>
      <p className="mt-1 text-sm text-muted">
        Optional, but listings with photos sell faster. The first image is the one buyers see on the
        card.
      </p>

      {capabilities && !uploadsEnabled ? (
        <div className="mt-4">
          <Alert tone="warning" title="Uploads are not configured">
            Add your Cloudinary credentials to <code className="font-mono">backend/.env</code> to
            enable file uploads. You can still paste image URLs below.
          </Alert>
        </div>
      ) : null}

      {errors.length > 0 ? (
        <div className="mt-4">
          <Alert tone="danger">
            <ul className="list-disc pl-5">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </Alert>
        </div>
      ) : null}

      {uploadsEnabled ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInput.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') fileInput.current?.click();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void handleFiles(event.dataTransfer.files);
          }}
          className={cn(
            'mt-6 cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
            dragging ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-line bg-surface',
            remainingSlots <= 0 && 'pointer-events-none opacity-50',
          )}
        >
          <p className="text-2xl" aria-hidden>
            📷
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">
            Drag photos here, or click to choose
          </p>
          <p className="mt-1 text-xs text-muted">
            {capabilities
              ? `Up to ${formatBytes(capabilities.maxBytes)} each · ${capabilities.allowedMimeTypes
                  .map((type) => type.replace('image/', '').toUpperCase())
                  .join(', ')}`
              : null}
            {remainingSlots > 0 ? ` · ${remainingSlots} slot${remainingSlots === 1 ? '' : 's'} left` : ' · limit reached'}
          </p>

          <input
            ref={fileInput}
            type="file"
            multiple
            accept={capabilities?.allowedMimeTypes.join(',')}
            className="sr-only"
            onChange={(event) => {
              void handleFiles(event.target.files);
              // Reset so re-selecting the same file fires a change event.
              event.target.value = '';
            }}
          />
        </div>
      ) : null}

      {pending.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {pending.map((item) => (
            <li key={item.id}>
              <Card className="px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-foreground">{item.name}</span>
                  <span className="shrink-0 text-muted">{item.percent}%</span>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted"
                  role="progressbar"
                  aria-valuenow={item.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full bg-brand-600 transition-[width] duration-200"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 space-y-3">
        {images.map((image, index) => (
          <Card key={`${image.url}-${index}`} className="flex flex-wrap items-start gap-3 p-3">
            <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
              {isProbablyUrl(image.url) ? (
                <Image src={image.url} alt="" fill sizes="96px" className="object-cover" unoptimized />
              ) : (
                <div className="grid h-full place-items-center text-xl text-muted" aria-hidden>
                  🖼️
                </div>
              )}
              {index === 0 ? (
                <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  Cover
                </span>
              ) : null}
            </div>

            <div className="min-w-56 flex-1 space-y-2">
              {image.storageKey ? (
                <p className="truncate text-xs text-muted" title={image.url}>
                  Uploaded · {image.width && image.height ? `${image.width}×${image.height}` : 'stored'}
                </p>
              ) : (
                <Input
                  value={image.url}
                  placeholder="https://example.com/photo.jpg"
                  onChange={(event) => update(index, { url: event.target.value })}
                />
              )}
              <Input
                value={image.alt}
                placeholder="Describe the photo (accessibility)"
                onChange={(event) => update(index, { alt: event.target.value })}
              />
            </div>

            <div className="flex gap-1">
              <Button variant="ghost" size="sm" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                ↑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Move down"
                disabled={index === images.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Remove photo"
                onClick={() => onChange(images.filter((_, i) => i !== index))}
              >
                ✕
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {remainingSlots > 0 ? (
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          onClick={() => onChange([...images, { url: '', alt: '' }])}
        >
          + Add image by URL
        </Button>
      ) : null}
    </div>
  );
}

function isProbablyUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}
