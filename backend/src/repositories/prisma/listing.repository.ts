import type { Prisma, PrismaClient } from '@prisma/client';
import type { ListingCondition, ListingStatus } from '../../core/types';
import type {
  CreateListingInput,
  IListingRepository,
  ListingQuery,
  ListingRecord,
  Paginated,
} from '../interfaces';

const LISTING_SELECT = {
  id: true,
  slug: true,
  sellerId: true,
  sellerName: true,
  categoryId: true,
  title: true,
  description: true,
  priceCents: true,
  currency: true,
  condition: true,
  city: true,
  status: true,
  attributes: true,
  schemaSnapshot: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true, icon: true } },
  images: {
    select: { id: true, url: true, alt: true, width: true, height: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
} as const;

type ListingRow = Omit<ListingRecord, 'condition' | 'status'> & {
  condition: string;
  status: string;
};

function toRecord(row: ListingRow): ListingRecord {
  return {
    ...row,
    condition: row.condition as ListingCondition,
    status: row.status as ListingStatus,
  };
}

export class PrismaListingRepository implements IListingRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Listing and images are written in a single transaction — Prisma's nested
   * create does this implicitly, so a listing can never be persisted with a
   * partial image set.
   */
  async create(input: CreateListingInput): Promise<ListingRecord> {
    const row = await this.db.listing.create({
      data: {
        slug: input.slug,
        sellerId: input.sellerId,
        sellerName: input.sellerName,
        categoryId: input.categoryId,
        title: input.title,
        description: input.description,
        priceCents: input.priceCents,
        currency: input.currency,
        condition: input.condition,
        city: input.city,
        status: input.status,
        attributes: input.attributes as Prisma.InputJsonValue,
        schemaSnapshot: input.schemaSnapshot as Prisma.InputJsonValue,
        images: {
          create: input.images.map((image, index) => ({
            url: image.url,
            storageKey: image.storageKey ?? null,
            alt: image.alt ?? null,
            width: image.width ?? null,
            height: image.height ?? null,
            // Position defines the primary image; index 0 is the card thumbnail.
            sortOrder: index,
          })),
        },
      },
      select: LISTING_SELECT,
    });

    return toRecord(row);
  }

  async findBySlug(slug: string): Promise<ListingRecord | null> {
    const row = await this.db.listing.findUnique({ where: { slug }, select: LISTING_SELECT });
    return row ? toRecord(row) : null;
  }

  async findById(id: string): Promise<ListingRecord | null> {
    const row = await this.db.listing.findUnique({ where: { id }, select: LISTING_SELECT });
    return row ? toRecord(row) : null;
  }

  async search(query: ListingQuery): Promise<Paginated<ListingRecord>> {
    const where: Prisma.ListingWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.categoryIds && query.categoryIds.length > 0
        ? { categoryId: { in: query.categoryIds } }
        : {}),
      ...(query.condition ? { condition: query.condition } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.minPriceCents !== undefined || query.maxPriceCents !== undefined
        ? {
            priceCents: {
              ...(query.minPriceCents !== undefined ? { gte: query.minPriceCents } : {}),
              ...(query.maxPriceCents !== undefined ? { lte: query.maxPriceCents } : {}),
            },
          }
        : {}),
    };

    // Count and page fetched together so the total matches the returned page.
    const [total, rows] = await this.db.$transaction([
      this.db.listing.count({ where }),
      this.db.listing.findMany({
        where,
        select: LISTING_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: query.offset,
        take: query.limit,
      }),
    ]);

    return {
      items: rows.map(toRecord),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async slugExists(slug: string): Promise<boolean> {
    const match = await this.db.listing.findUnique({ where: { slug }, select: { id: true } });
    return match !== null;
  }

  async updateStatus(id: string, status: ListingStatus): Promise<ListingRecord> {
    const row = await this.db.listing.update({
      where: { id },
      data: { status },
      select: LISTING_SELECT,
    });
    return toRecord(row);
  }
}
