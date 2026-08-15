import { NotFoundError, ValidationError } from '../core/errors';
import { buildSnapshot } from '../core/schema/snapshot';
import { hasErrors, validateAttributes } from '../core/schema/validator';
import type {
  ICategoryRepository,
  IListingRepository,
  ListingRecord,
  Paginated,
} from '../repositories/interfaces';
import { uniqueSlug } from '../utils/slug';
import type { CreateListingRequest, ListListingsRequest } from '../validators/listing.validators';
import type { FormSchemaService } from './form-schema.service';

export interface SellerIdentity {
  id: string;
  name: string;
}

export class ListingService {
  constructor(
    private readonly listings: IListingRepository,
    private readonly categories: ICategoryRepository,
    private readonly formSchemas: FormSchemaService,
    private readonly seller: SellerIdentity,
  ) {}

  /**
   * Creates a listing.
   *
   * The order of operations is the whole point of the architecture:
   *   1. resolve the category's field definitions
   *   2. validate + normalise + strip hidden answers (schema engine)
   *   3. freeze the definitions used into a snapshot
   *   4. persist listing and images in one transaction
   *
   * No step here knows anything about a specific category. Adding "Bicycle"
   * with ten new fields changes nothing in this method.
   */
  async create(request: CreateListingRequest): Promise<ListingRecord> {
    const category = await this.categories.findById(request.categoryId);
    if (!category) throw new NotFoundError('Category', request.categoryId);
    if (!category.isActive) {
      throw new ValidationError({ categoryId: 'This category is no longer accepting listings.' });
    }

    const schema = await this.formSchemas.getById(category.id);
    const result = validateAttributes(schema, request.attributes);

    if (hasErrors(result)) {
      // Namespaced so the client can map errors onto dynamic inputs without
      // colliding with a common field that happens to share a name.
      const fieldErrors = Object.fromEntries(
        Object.entries(result.errors).map(([key, message]) => [`attributes.${key}`, message]),
      );
      throw new ValidationError(fieldErrors, 'Some category details need attention.');
    }

    const snapshot = buildSnapshot(result.visibleFields, result.values);
    const slug = await uniqueSlug(request.title, (candidate) => this.listings.slugExists(candidate));

    return this.listings.create({
      slug,
      sellerId: this.seller.id,
      sellerName: this.seller.name,
      categoryId: category.id,
      title: request.title,
      description: request.description,
      // Money is stored as an integer minor unit to avoid float drift.
      priceCents: Math.round(request.price * 100),
      currency: request.currency,
      condition: request.condition,
      city: request.city,
      status: request.status,
      attributes: result.values,
      schemaSnapshot: snapshot,
      images: request.images,
    });
  }

  async getBySlug(slug: string): Promise<ListingRecord> {
    const listing = await this.listings.findBySlug(slug);
    if (!listing) throw new NotFoundError('Listing', slug);
    return listing;
  }

  /**
   * Filtering by a parent category includes its descendants, so browsing
   * "Electronics" shows phones and laptops rather than nothing.
   */
  async list(request: ListListingsRequest): Promise<Paginated<ListingRecord>> {
    let categoryIds: string[] | undefined;

    if (request.category) {
      const category = await this.categories.findBySlug(request.category);
      if (!category) throw new NotFoundError('Category', request.category);
      categoryIds = await this.categories.findDescendantIds(category.id);
    }

    return this.listings.search({
      categoryIds,
      search: request.q,
      condition: request.condition,
      status: 'ACTIVE',
      minPriceCents: request.minPrice !== undefined ? Math.round(request.minPrice * 100) : undefined,
      maxPriceCents: request.maxPrice !== undefined ? Math.round(request.maxPrice * 100) : undefined,
      limit: request.limit,
      offset: request.offset,
    });
  }
}
