import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ImageGallery } from '@/components/listings/image-gallery';
import { ListingActions } from '@/components/listings/listing-actions';
import { Badge, Card } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import type { Listing } from '@/lib/types';
import { CONDITION_LABELS, formatPrice, formatRelativeDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function loadListing(slug: string): Promise<Listing> {
  try {
    return await api.listings.get(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

/** Typed explicitly rather than via the generated `PageProps` helper, which is
 *  only emitted after a build has run. */
interface ListingPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ListingPageProps) {
  const { slug } = await params;
  try {
    const listing = await api.listings.get(slug);
    return { title: `${listing.title} — CircleStore`, description: listing.description.slice(0, 160) };
  } catch {
    return { title: 'Listing — CircleStore' };
  }
}

/**
 * Product detail page.
 *
 * The specification rows come from `listing.details`, which the API builds from
 * the listing's OWN schema snapshot — the field definitions frozen at publish
 * time. An admin renaming or deactivating a field afterwards cannot alter what
 * this page shows, which is the point of ADR-004.
 */
export default async function ListingPage({ params }: ListingPageProps) {
  const { slug } = await params;
  const listing = await loadListing(slug);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/?category=${listing.category.slug}`} className="hover:text-foreground">
          {listing.category.name}
        </Link>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <ImageGallery images={listing.images} title={listing.title} />

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">
              {listing.category.icon} {listing.category.name}
            </Badge>
            <Badge>{CONDITION_LABELS[listing.condition]}</Badge>
            {listing.status !== 'ACTIVE' ? <Badge tone="warning">{listing.status}</Badge> : null}
          </div>

          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {listing.title}
          </h1>

          <p className="mt-3 text-3xl font-bold text-foreground">
            {formatPrice(listing.price, listing.currency)}
          </p>

          <p className="mt-2 text-sm text-muted">
            {listing.city} · Listed {formatRelativeDate(listing.createdAt).toLowerCase()} by{' '}
            {listing.seller.name}
          </p>

          <ListingActions sellerName={listing.seller.name} />

          <Card className="mt-6 p-5">
            <h2 className="text-sm font-semibold text-foreground">Description</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">
              {listing.description}
            </p>
          </Card>
        </div>
      </div>

      {listing.details.length > 0 ? (
        <section className="mt-12">
          <h2 className="mb-5 text-lg font-semibold text-foreground">Item details</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {listing.details.map((section) => (
              <Card key={section.section} className="overflow-hidden">
                <h3 className="border-b border-line bg-surface-muted px-5 py-3 text-sm font-semibold text-foreground">
                  {section.section}
                </h3>
                <dl className="divide-y divide-line">
                  {section.rows.map((row) => (
                    <div key={row.key} className="flex justify-between gap-4 px-5 py-3 text-sm">
                      <dt className="text-muted">{row.label}</dt>
                      <dd className="text-right font-medium text-foreground">{row.displayValue}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
