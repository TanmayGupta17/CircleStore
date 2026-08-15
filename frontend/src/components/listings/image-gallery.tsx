'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Listing } from '@/lib/types';

export function ImageGallery({ images, title }: { images: Listing['images']; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex];

  if (!active) {
    return (
      <div className="grid aspect-4/3 place-items-center rounded-xl border border-line bg-surface-muted text-5xl text-muted">
        📦
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-4/3 overflow-hidden rounded-xl border border-line bg-surface-muted">
        <Image
          src={active.url}
          alt={active.alt ?? title}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 60vw"
          className="object-cover"
        />
      </div>

      {images.length > 1 ? (
        <div className="mt-3 flex gap-2">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Show image ${index + 1}`}
              aria-current={index === activeIndex}
              className={cn(
                'relative h-16 w-20 overflow-hidden rounded-lg border-2 transition-colors',
                index === activeIndex ? 'border-brand-600' : 'border-line hover:border-muted/50',
              )}
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
