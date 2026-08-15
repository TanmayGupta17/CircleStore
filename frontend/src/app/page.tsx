import Link from 'next/link';
import { ListingCard } from '@/components/listings/listing-card';
import { Alert, EmptyState, LinkButton } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Homepage.
 *
 * A Server Component: listings and categories are fetched during render, so the
 * page ships no data-fetching JavaScript to the browser.
 */
export default async function HomePage({ searchParams }: PageProps<'/'>) {
  const params = await searchParams;
  const activeCategory = typeof params.category === 'string' ? params.category : undefined;
  const search = typeof params.q === 'string' ? params.q : undefined;

  let listings;
  let categories;

  try {
    [listings, categories] = await Promise.all([
      api.listings.list({ category: activeCategory, q: search, limit: 24 }),
      api.categories.list(),
    ]);
  } catch {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <Alert tone="danger" title="Cannot reach the API">
          Start the backend with <code className="font-mono">npm run dev</code> in{' '}
          <code className="font-mono">backend/</code>, then reload this page.
        </Alert>
      </div>
    );
  }

  // With ~35 categories a flat pill row is unusable, so browse by top-level
  // group and reveal children once one is selected.
  const topLevel = categories.filter((category) => !category.parentId);
  const selected = categories.find((category) => category.slug === activeCategory);
  const groupId = selected ? (selected.parentId ?? selected.id) : null;
  const children = groupId
    ? categories.filter((category) => category.parentId === groupId)
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <section className="mb-10 rounded-2xl border border-line bg-surface px-6 py-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Buy and sell secondhand, properly described
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted">
          Every category asks exactly the questions that matter — storage and battery health for a
          phone, seating capacity and material for a sofa. Configured by admins, never hard-coded.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <LinkButton href="/sell" size="lg">
            Sell an item
          </LinkButton>
          <LinkButton href="/admin/categories" variant="secondary" size="lg">
            Configure categories
          </LinkButton>
        </div>
      </section>

      <nav className="mb-8 flex flex-wrap gap-2" aria-label="Filter by category">
        <CategoryPill href="/" label="All" active={!activeCategory} />
        {topLevel.map((category) => (
          <CategoryPill
            key={category.id}
            href={`/?category=${category.slug}`}
            label={`${category.icon ?? ''} ${category.name}`.trim()}
            active={activeCategory === category.slug}
          />
        ))}
      </nav>

      {/* Drill-down: once a group is chosen, offer its children. */}
      {children.length > 0 ? (
        <nav className="-mt-4 mb-8 flex flex-wrap gap-2" aria-label="Filter by sub-category">
          {children.map((category) => (
            <CategoryPill
              key={category.id}
              href={`/?category=${category.slug}`}
              label={category.name}
              count={category.listingCount}
              active={activeCategory === category.slug}
              subtle
            />
          ))}
        </nav>
      ) : null}

      {listings.items.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No listings yet"
          description={
            activeCategory
              ? 'Nothing in this category so far. Try another one, or create the first listing.'
              : 'Seed the database or create the first listing to see it here.'
          }
          action={<LinkButton href="/sell">Create a listing</LinkButton>}
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            {listings.total} {listings.total === 1 ? 'listing' : 'listings'}
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {listings.items.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CategoryPill({
  href,
  label,
  count,
  active,
  subtle,
}: {
  href: string;
  label: string;
  count?: number;
  active: boolean;
  subtle?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-full border transition-colors',
        subtle ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm',
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-line bg-surface text-muted hover:border-muted/50 hover:text-foreground',
      )}
    >
      {label}
      {count !== undefined ? <span className="ml-1.5 opacity-70">{count}</span> : null}
    </Link>
  );
}
