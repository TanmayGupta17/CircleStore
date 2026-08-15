/**
 * API contract types.
 *
 * These mirror the backend's presenter output. They are hand-written rather
 * than imported because the frontend is a separate deployable and must not
 * depend on the backend's build — the API response is the contract, not the
 * TypeScript source.
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

export type ListingCondition = 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR';

export interface ValidationConfig {
  min?: number | string;
  max?: number | string;
  step?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  minSelected?: number;
  maxSelected?: number;
}

export interface FieldOptionDef {
  value: string;
  label: string;
  sortOrder: number;
}

export type VisibilityOperator =
  | 'eq' | 'neq' | 'in' | 'nin' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'truthy' | 'falsy';

export interface VisibilityCondition {
  field: string;
  op: VisibilityOperator;
  value?: unknown;
}

export interface VisibilityRule {
  all?: VisibilityNode[];
  any?: VisibilityNode[];
  not?: VisibilityNode;
}

export type VisibilityNode = VisibilityCondition | VisibilityRule;

export interface FieldDefinition {
  fieldId: string;
  key: string;
  label: string;
  type: FieldType;
  helpText: string | null;
  unit: string | null;
  placeholder: string | null;
  defaultValue: string | null;
  options: FieldOptionDef[];
  validation: ValidationConfig;
  isRequired: boolean;
  section: string;
  sortOrder: number;
  showInCard: boolean;
  visibilityRule: VisibilityRule | null;
  inheritedFrom: { categoryId: string; categoryName: string } | null;
}

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
}

export interface FormSection {
  title: string;
  fields: FieldDefinition[];
}

/** The contract that drives the seller form, the validator and the preview. */
export interface FormSchema {
  category: CategorySummary;
  ancestors: CategorySummary[];
  sections: FormSection[];
  fields: FieldDefinition[];
}

export interface Category extends CategorySummary {
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  listingCount: number;
  fieldCount: number;
}

export interface DetailRow {
  key: string;
  label: string;
  section: string;
  value: unknown;
  displayValue: string;
}

export interface Listing {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  condition: ListingCondition;
  city: string;
  status: string;
  seller: { id: string; name: string };
  category: { id: string; name: string; slug: string; icon: string | null };
  images: Array<{ id: string; url: string; alt: string | null; width: number | null; height: number | null }>;
  attributes: Record<string, unknown>;
  details: Array<{ section: string; rows: DetailRow[] }>;
  highlights: DetailRow[];
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// --- Uploads -------------------------------------------------------------

export interface UploadCapabilities {
  enabled: boolean;
  provider: string;
  maxBytes: number;
  allowedMimeTypes: string[];
}

/** Short-lived credentials for posting a file straight to the storage provider. */
export interface SignedUpload {
  uploadUrl: string;
  fields: Record<string, string>;
  folder: string;
  expiresAt: string;
}

// --- Admin ---------------------------------------------------------------

export interface FieldOption {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Field {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  helpText: string | null;
  unit: string | null;
  placeholder: string | null;
  defaultValue: string | null;
  validation: ValidationConfig;
  isActive: boolean;
  options: FieldOption[];
  usageCount?: number;
}

export interface FieldTypeInfo {
  type: FieldType;
  label: string;
  usesOptions: boolean;
}

export interface FieldImpact {
  attachments: number;
  listingsWithValue: number;
}

/**
 * An attachment as returned by the admin endpoint: the join-table configuration
 * plus the field it points at. Carries the row `id`, which the public
 * form-schema deliberately omits.
 */
export interface CategoryAttachmentRow {
  id: string;
  categoryId: string;
  isRequired: boolean;
  sortOrder: number;
  section: string;
  showInCard: boolean;
  visibilityRule: VisibilityRule | null;
  overrides: ValidationConfig | null;
  field: {
    id: string;
    key: string;
    label: string;
    type: FieldType;
    unit: string | null;
    isActive: boolean;
    options: Array<{ value: string; label: string; sortOrder: number; isActive: boolean }>;
  };
}

export interface CategoryFieldAttachment {
  id: string;
  categoryId: string;
  fieldId: string;
  isRequired: boolean;
  sortOrder: number;
  section: string;
  showInCard: boolean;
  visibilityRule: VisibilityRule | null;
  overrides: ValidationConfig | null;
}
