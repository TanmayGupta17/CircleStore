import type { PrismaClient } from '@prisma/client';
import type {
  CategoryInput,
  CategoryRecord,
  CategoryWithCounts,
  ICategoryRepository,
} from '../interfaces';

const CATEGORY_FIELDS = {
  id: true,
  name: true,
  slug: true,
  description: true,
  icon: true,
  parentId: true,
  sortOrder: true,
  isActive: true,
} as const;

export class PrismaCategoryRepository implements ICategoryRepository {
  constructor(private readonly db: PrismaClient) {}

  async findAll(options: { includeInactive?: boolean } = {}): Promise<CategoryWithCounts[]> {
    const rows = await this.db.category.findMany({
      where: options.includeInactive ? {} : { isActive: true },
      select: {
        ...CATEGORY_FIELDS,
        _count: { select: { listings: true, categoryFields: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return rows.map(({ _count, ...category }) => ({
      ...category,
      listingCount: _count.listings,
      fieldCount: _count.categoryFields,
    }));
  }

  async findById(id: string): Promise<CategoryRecord | null> {
    return this.db.category.findUnique({ where: { id }, select: CATEGORY_FIELDS });
  }

  async findBySlug(slug: string): Promise<CategoryRecord | null> {
    return this.db.category.findUnique({ where: { slug }, select: CATEGORY_FIELDS });
  }

  /**
   * Walks up the parent chain. Iterative rather than a recursive CTE because
   * category trees here are shallow (2-3 levels) and this keeps the query
   * portable; the loop is bounded to prevent a cycle from hanging the request.
   */
  async findAncestors(categoryId: string): Promise<CategoryRecord[]> {
    const chain: CategoryRecord[] = [];
    const seen = new Set<string>([categoryId]);

    let current = await this.findById(categoryId);
    let guard = 0;

    while (current?.parentId && guard < 20) {
      if (seen.has(current.parentId)) break; // Defensive: corrupt data cycle.
      const parent = await this.findById(current.parentId);
      if (!parent) break;

      seen.add(parent.id);
      chain.push(parent);
      current = parent;
      guard += 1;
    }

    return chain.reverse(); // Root first.
  }

  async findDescendantIds(categoryId: string): Promise<string[]> {
    const ids = [categoryId];
    let frontier = [categoryId];
    let guard = 0;

    while (frontier.length > 0 && guard < 20) {
      const children = await this.db.category.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true },
      });

      frontier = children.map((child) => child.id).filter((id) => !ids.includes(id));
      ids.push(...frontier);
      guard += 1;
    }

    return ids;
  }

  async create(input: CategoryInput): Promise<CategoryRecord> {
    return this.db.category.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        icon: input.icon ?? null,
        parentId: input.parentId ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
      select: CATEGORY_FIELDS,
    });
  }

  async update(id: string, input: Partial<CategoryInput>): Promise<CategoryRecord> {
    return this.db.category.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.icon !== undefined && { icon: input.icon }),
        ...(input.parentId !== undefined && { parentId: input.parentId }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      },
      select: CATEGORY_FIELDS,
    });
  }

  async setActive(id: string, isActive: boolean): Promise<CategoryRecord> {
    return this.db.category.update({ where: { id }, data: { isActive }, select: CATEGORY_FIELDS });
  }

  async countListings(categoryId: string): Promise<number> {
    return this.db.listing.count({ where: { categoryId } });
  }

  async slugExists(slug: string, exceptId?: string): Promise<boolean> {
    const match = await this.db.category.findFirst({
      where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });
    return match !== null;
  }
}
