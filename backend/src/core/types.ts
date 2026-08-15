/**
 * Domain types for the schema engine.
 *
 * Everything in `src/core` is PURE: no Prisma, no Express, no I/O. It takes
 * plain objects in and returns plain objects out. That is what makes the engine
 * unit-testable without a database and portable if the transport ever changes.
 */

export const FIELD_TYPES = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'SELECT',
  'MULTISELECT',
  'RADIO',
  'BOOLEAN',
  'DATE',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const LISTING_CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'] as const;
export type ListingCondition = (typeof LISTING_CONDITIONS)[number];

export const LISTING_STATUSES = ['DRAFT', 'ACTIVE', 'SOLD', 'ARCHIVED'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/**
 * Validation rules. Which keys apply depends on the field type — each
 * field-type strategy reads only the ones it understands and ignores the rest.
 */
export interface ValidationConfig {
  /** Numeric bound for NUMBER; ISO `YYYY-MM-DD` string for DATE. */
  min?: number | string;
  /** Numeric bound for NUMBER; ISO `YYYY-MM-DD` string for DATE. */
  max?: number | string;
  step?: number;
  minLength?: number;
  maxLength?: number;
  /** Serialised RegExp source. Applied to TEXT/TEXTAREA only. */
  pattern?: string;
  /** Human-readable message shown when `pattern` fails. */
  patternMessage?: string;
  /** MULTISELECT only. */
  minSelected?: number;
  maxSelected?: number;
}

export interface FieldOptionDef {
  value: string;
  label: string;
  sortOrder: number;
}

// ---------------------------------------------------------------------------
// Conditional visibility
// ---------------------------------------------------------------------------

export const VISIBILITY_OPERATORS = [
  'eq',
  'neq',
  'in',
  'nin',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'truthy',
  'falsy',
] as const;

export type VisibilityOperator = (typeof VISIBILITY_OPERATORS)[number];

export interface VisibilityCondition {
  /** `Field.key` of the controlling field. */
  field: string;
  op: VisibilityOperator;
  /** Omitted for the unary `truthy` / `falsy` operators. */
  value?: unknown;
}

/**
 * Rules nest, so `{ all: [c1, { any: [c2, c3] }] }` is expressible.
 * Exactly one of `all` / `any` / `not` should be set on a given node.
 */
export interface VisibilityRule {
  all?: VisibilityNode[];
  any?: VisibilityNode[];
  not?: VisibilityNode;
}

export type VisibilityNode = VisibilityCondition | VisibilityRule;

// ---------------------------------------------------------------------------
// Resolved field definition — the render-ready shape
// ---------------------------------------------------------------------------

/**
 * The output of the resolver: a `Field` merged with its `CategoryField`
 * configuration. This is the ONLY field shape the form renderer, the
 * validator and the PDP ever see. They never touch the database rows.
 */
export interface FieldDefinition {
  fieldId: string;
  /** Storage key inside `Listing.attributes`. */
  key: string;
  label: string;
  type: FieldType;
  helpText: string | null;
  unit: string | null;
  placeholder: string | null;
  defaultValue: string | null;
  options: FieldOptionDef[];
  /** Base validation merged with the per-category overrides. */
  validation: ValidationConfig;
  isRequired: boolean;
  section: string;
  sortOrder: number;
  showInCard: boolean;
  visibilityRule: VisibilityRule | null;
  /**
   * Set when the field came from an ancestor category rather than being
   * attached directly, so the admin UI can show it as inherited/read-only.
   */
  inheritedFrom: { categoryId: string; categoryName: string } | null;
}

export interface FormSection {
  title: string;
  fields: FieldDefinition[];
}

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
}

/**
 * The single contract that drives the whole product: the sell form renders it,
 * the server validates against it, and the admin previews it.
 */
export interface FormSchema {
  category: CategorySummary;
  /** Ancestor chain, root first. Empty for a top-level category. */
  ancestors: CategorySummary[];
  /** Grouped for rendering. */
  sections: FormSection[];
  /** Flat and ordered — convenient for validation and lookups. */
  fields: FieldDefinition[];
}

/**
 * Values keyed by `Field.key`. This is exactly the shape stored in
 * `Listing.attributes`.
 */
export type AttributeValues = Record<string, unknown>;
