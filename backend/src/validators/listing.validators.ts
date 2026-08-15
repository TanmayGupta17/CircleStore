import { z } from 'zod';
import { LISTING_CONDITIONS } from '../core/types';

/**
 * Request schemas for the COMMON listing fields.
 *
 * Note the split: common fields are validated by this static schema because the
 * application reasons about them (search, sort, cards). Category-specific
 * answers are validated dynamically by the schema engine against the database's
 * field definitions. Two mechanisms, deliberately — see README ADR-002.
 */

const imageSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'Image URL is required.')
    .max(2048)
    .refine(
      (value) => /^https?:\/\//i.test(value) || value.startsWith('/'),
      'Image URL must be an http(s) URL or a site-relative path.',
    ),
  storageKey: z.string().trim().max(512).nullish(),
  alt: z.string().trim().max(200).nullish(),
  width: z.number().int().positive().max(20000).nullish(),
  height: z.number().int().positive().max(20000).nullish(),
});

export const createListingSchema = z.object({
  categoryId: z.string().uuid('A valid category must be selected.'),

  title: z
    .string()
    .trim()
    .min(5, 'Title must be at least 5 characters.')
    .max(120, 'Title must be at most 120 characters.'),

  description: z
    .string()
    .trim()
    .min(20, 'Description must be at least 20 characters.')
    .max(5000, 'Description must be at most 5000 characters.'),

  /** Major currency units (rupees), converted to integer paise for storage. */
  price: z
    .number({ invalid_type_error: 'Price must be a number.' })
    .nonnegative('Price cannot be negative.')
    .max(100_000_000, 'Price is unrealistically high.'),

  currency: z.string().trim().length(3).default('INR'),

  condition: z.enum(LISTING_CONDITIONS, {
    errorMap: () => ({ message: 'Select the item condition.' }),
  }),

  city: z.string().trim().min(2, 'City is required.').max(80),

  images: z.array(imageSchema).max(10, 'A listing can have at most 10 images.').default([]),

  /** Category-specific answers, keyed by field key. Validated by the engine. */
  attributes: z.record(z.unknown()).default({}),

  status: z.enum(['DRAFT', 'ACTIVE']).default('ACTIVE'),
});

export type CreateListingRequest = z.infer<typeof createListingSchema>;

export const listListingsSchema = z.object({
  category: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  condition: z.enum(LISTING_CONDITIONS).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListListingsRequest = z.infer<typeof listListingsSchema>;
