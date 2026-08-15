import { parseSnapshot, type SnapshotEntry } from '../core/schema/snapshot';
import type { AttributeValues } from '../core/types';
import type { ListingRecord, Paginated } from '../repositories/interfaces';

/**
 * The "view" of MVC: shapes domain records into the JSON the client consumes.
 *
 * Presenters keep formatting out of both the services (which own rules) and the
 * controllers (which own HTTP). Critically, the PDP's detail rows are assembled
 * HERE from the listing's `schemaSnapshot` — never from live field definitions —
 * so an admin editing a field can never rewrite what a seller published.
 */

export interface DetailRow {
  key: string;
  label: string;
  section: string;
  value: unknown;
  /** Pre-rendered for display; the raw `value` is still available. */
  displayValue: string;
}

export interface ListingDto {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  condition: string;
  city: string;
  status: string;
  seller: { id: string; name: string };
  category: { id: string; name: string; slug: string; icon: string | null };
  images: Array<{ id: string; url: string; alt: string | null; width: number | null; height: number | null }>;
  attributes: AttributeValues;
  /** Grouped, ordered detail rows built from the snapshot. */
  details: Array<{ section: string; rows: DetailRow[] }>;
  /** Highlights for the product card. */
  highlights: DetailRow[];
  createdAt: string;
}

export function presentListing(listing: ListingRecord): ListingDto {
  const snapshot = parseSnapshot(listing.schemaSnapshot);
  const attributes = (listing.attributes ?? {}) as AttributeValues;

  const rows = snapshot
    .filter((entry) => attributes[entry.key] !== undefined && attributes[entry.key] !== null)
    .map((entry) => toDetailRow(entry, attributes[entry.key]));

  return {
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    description: listing.description,
    price: listing.priceCents / 100,
    currency: listing.currency,
    condition: listing.condition,
    city: listing.city,
    status: listing.status,
    seller: { id: listing.sellerId, name: listing.sellerName },
    category: listing.category,
    images: listing.images.map(({ id, url, alt, width, height }) => ({ id, url, alt, width, height })),
    attributes,
    details: groupBySection(rows),
    highlights: snapshot
      .filter((entry) => entry.showInCard && attributes[entry.key] !== undefined)
      .map((entry) => toDetailRow(entry, attributes[entry.key]))
      .slice(0, 3),
    createdAt: listing.createdAt.toISOString(),
  };
}

export function presentListingList(page: Paginated<ListingRecord>): {
  items: ListingDto[];
  total: number;
  limit: number;
  offset: number;
} {
  return {
    items: page.items.map(presentListing),
    total: page.total,
    limit: page.limit,
    offset: page.offset,
  };
}

function toDetailRow(entry: SnapshotEntry, value: unknown): DetailRow {
  return {
    key: entry.key,
    label: entry.label,
    section: entry.section,
    value: value ?? null,
    displayValue: formatValue(entry, value),
  };
}

/**
 * Renders a stored value using the snapshot's own metadata, so a renamed or
 * deleted option still displays the label that was live at publish time.
 */
function formatValue(entry: SnapshotEntry, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';

  const labelFor = (raw: unknown): string =>
    entry.options?.find((option) => option.value === String(raw))?.label ?? String(raw);

  switch (entry.type) {
    case 'BOOLEAN':
      return value ? 'Yes' : 'No';
    case 'MULTISELECT':
      return Array.isArray(value) && value.length > 0 ? value.map(labelFor).join(', ') : '—';
    case 'SELECT':
    case 'RADIO':
      return labelFor(value);
    case 'NUMBER':
      return entry.unit ? `${value} ${entry.unit}` : String(value);
    case 'DATE':
      return formatDate(String(value));
    default:
      return entry.unit ? `${value} ${entry.unit}` : String(value);
  }
}

function formatDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function groupBySection(rows: DetailRow[]): Array<{ section: string; rows: DetailRow[] }> {
  const sections: Array<{ section: string; rows: DetailRow[] }> = [];
  const indexByName = new Map<string, number>();

  for (const row of rows) {
    const index = indexByName.get(row.section);
    if (index === undefined) {
      indexByName.set(row.section, sections.length);
      sections.push({ section: row.section, rows: [row] });
    } else {
      sections[index]?.rows.push(row);
    }
  }

  return sections;
}
