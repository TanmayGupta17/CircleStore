import type { RawCategoryFieldRow, RawCategoryRow } from '../core/schema/resolver';
import type { FieldType, ListingCondition, ListingStatus, VisibilityRule } from '../core/types';

/**
 * Repository contracts — the seam between business logic and persistence.
 *
 * Services depend on these interfaces, never on Prisma (Dependency Inversion).
 * Swapping the ORM, adding a caching decorator, or supplying an in-memory fake
 * in tests requires no change above this line.
 */

// ---------------------------------------------------------------------------
// Records returned to the service layer
// ---------------------------------------------------------------------------

export interface CategoryRecord extends RawCategoryRow {
  sortOrder: number;
  isActive: boolean;
}

export interface CategoryWithCounts extends CategoryRecord {
  listingCount: number;
  fieldCount: number;
}

export interface FieldOptionRecord {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface FieldRecord {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  helpText: string | null;
  unit: string | null;
  placeholder: string | null;
  defaultValue: string | null;
  validation: unknown;
  isActive: boolean;
  options: FieldOptionRecord[];
  /** How many categories currently attach this field. */
  usageCount?: number;
}

export interface CategoryFieldRecord {
  id: string;
  categoryId: string;
  fieldId: string;
  isRequired: boolean;
  sortOrder: number;
  section: string;
  showInCard: boolean;
  visibilityRule: unknown;
  overrides: unknown;
}

export interface ListingImageRecord {
  id: string;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
}

export interface ListingRecord {
  id: string;
  slug: string;
  sellerId: string;
  sellerName: string;
  categoryId: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  condition: ListingCondition;
  city: string;
  status: ListingStatus;
  attributes: unknown;
  schemaSnapshot: unknown;
  images: ListingImageRecord[];
  category: Pick<CategoryRecord, 'id' | 'name' | 'slug' | 'icon'>;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface CategoryInput {
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  parentId?: string | null;
  sortOrder?: number;
}

export interface FieldOptionInput {
  value: string;
  label: string;
  sortOrder: number;
}

export interface FieldInput {
  key: string;
  label: string;
  type: FieldType;
  helpText?: string | null;
  unit?: string | null;
  placeholder?: string | null;
  defaultValue?: string | null;
  validation?: Record<string, unknown>;
  options?: FieldOptionInput[];
}

/** `key` and `type` are absent: both are immutable after creation. */
export type FieldUpdateInput = Partial<Omit<FieldInput, 'key' | 'type'>>;

export interface AttachFieldInput {
  categoryId: string;
  fieldId: string;
  isRequired?: boolean;
  sortOrder?: number;
  section?: string;
  showInCard?: boolean;
  visibilityRule?: VisibilityRule | null;
  overrides?: Record<string, unknown> | null;
}

export type UpdateAttachmentInput = Partial<Omit<AttachFieldInput, 'categoryId' | 'fieldId'>>;

export interface ListingImageInput {
  url: string;
  storageKey?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface CreateListingInput {
  slug: string;
  sellerId: string;
  sellerName: string;
  categoryId: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  condition: ListingCondition;
  city: string;
  status: ListingStatus;
  attributes: Record<string, unknown>;
  schemaSnapshot: unknown;
  images: ListingImageInput[];
}

export interface ListingQuery {
  categorySlug?: string;
  /** Includes descendants of the given category. */
  categoryIds?: string[];
  search?: string;
  condition?: ListingCondition;
  status?: ListingStatus;
  minPriceCents?: number;
  maxPriceCents?: number;
  limit: number;
  offset: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export interface ICategoryRepository {
  findAll(options?: { includeInactive?: boolean }): Promise<CategoryWithCounts[]>;
  findById(id: string): Promise<CategoryRecord | null>;
  findBySlug(slug: string): Promise<CategoryRecord | null>;
  /** Root-first ancestor chain, excluding the category itself. */
  findAncestors(categoryId: string): Promise<CategoryRecord[]>;
  /** The category plus every descendant id, for filtering listings by a parent. */
  findDescendantIds(categoryId: string): Promise<string[]>;
  create(input: CategoryInput): Promise<CategoryRecord>;
  update(id: string, input: Partial<CategoryInput>): Promise<CategoryRecord>;
  setActive(id: string, isActive: boolean): Promise<CategoryRecord>;
  countListings(categoryId: string): Promise<number>;
  slugExists(slug: string, exceptId?: string): Promise<boolean>;
}

export interface IFieldRepository {
  findAll(options?: { includeInactive?: boolean; search?: string }): Promise<FieldRecord[]>;
  findById(id: string): Promise<FieldRecord | null>;
  findByKey(key: string): Promise<FieldRecord | null>;
  create(input: FieldInput): Promise<FieldRecord>;
  /** Replaces the option set wholesale when `options` is supplied. */
  update(id: string, input: FieldUpdateInput): Promise<FieldRecord>;
  setActive(id: string, isActive: boolean): Promise<FieldRecord>;
  /** Number of listings holding a stored value for this field key. */
  countListingsWithValue(key: string): Promise<number>;
  /** Number of categories this field is attached to. */
  countAttachments(fieldId: string): Promise<number>;
}

export interface ICategoryFieldRepository {
  /** Attachments for the given categories, with field and options eagerly loaded. */
  findByCategoryIds(categoryIds: string[]): Promise<RawCategoryFieldRow[]>;
  findById(id: string): Promise<CategoryFieldRecord | null>;
  findOne(categoryId: string, fieldId: string): Promise<CategoryFieldRecord | null>;
  attach(input: AttachFieldInput): Promise<CategoryFieldRecord>;
  update(id: string, input: UpdateAttachmentInput): Promise<CategoryFieldRecord>;
  detach(id: string): Promise<void>;
  /** Applies a new ordering atomically. */
  reorder(categoryId: string, orderedIds: string[]): Promise<void>;
  nextSortOrder(categoryId: string): Promise<number>;
}

export interface IListingRepository {
  create(input: CreateListingInput): Promise<ListingRecord>;
  findBySlug(slug: string): Promise<ListingRecord | null>;
  findById(id: string): Promise<ListingRecord | null>;
  search(query: ListingQuery): Promise<Paginated<ListingRecord>>;
  slugExists(slug: string): Promise<boolean>;
  updateStatus(id: string, status: ListingStatus): Promise<ListingRecord>;
}
