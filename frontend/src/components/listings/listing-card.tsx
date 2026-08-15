import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui';
import type { Listing } from '@/lib/types';
import { CONDITION_LABELS, formatPrice, formatRelativeDate } from '@/lib/utils';

/**
 * Product card.
 *
 * `highlights` come from the listing's schema snapshot — the fields an admin
 * flagged with `showInCard`. That means a category-specific value like "256 GB"
 * can surface on the card WITHOUT being promoted to a column on the listing
 * table, and which values appear is configuration, not code.
 */
export function ListingCard({ listing }: { listing: Listing }) {
  const cover = listing.images[0];

  return (
    <Link
      href={`/listings/${listing.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-surface-muted">
        {cover ? (
          <Image
            src={cover.url}
            alt={cover.alt ?? listing.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-3xl text-muted" aria-hidden>
            {listing.category.icon ?? '📦'}
          </div>
        )}

        <div className="absolute left-2 top-2">
          <Badge tone="neutral" className="bg-black/60 text-white backdrop-blur">
            {CONDITION_LABELS[listing.condition]}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs text-muted">
          {listing.category.icon} {listing.category.name}
        </p>

        <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-foreground group-hover:text-brand-600">
          {listing.title}
        </h3>

        <p className="mt-2 text-lg font-bold text-foreground">
          {formatPrice(listing.price, listing.currency)}
        </p>

        {listing.highlights.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {listing.highlights.map((highlight) => (
              <li key={highlight.key}>
                <Badge tone="brand">{highlight.displayValue}</Badge>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-auto pt-3 text-xs text-muted">
          {listing.city} · {formatRelativeDate(listing.createdAt)}
        </p>
      </div>
    </Link>
  );
}
