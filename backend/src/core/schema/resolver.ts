import type {
  CategorySummary,
  FieldDefinition,
  FieldOptionDef,
  FieldType,
  FormSchema,
  FormSection,
  ValidationConfig,
  VisibilityRule,
} from '../types';

/**
 * Turns database rows into the render-ready `FormSchema`.
 *
 * Pure by design: it receives already-fetched plain objects, so the resolution
 * rules (inheritance, overrides, ordering, grouping) are testable without a
 * database and cannot accidentally issue a query inside a loop.
 */

export interface RawCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  parentId: string | null;
}

export interface RawFieldOptionRow {
  value: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface RawFieldRow {
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
  options: RawFieldOptionRow[];
}

export interface RawCategoryFieldRow {
  /** Attachment row id. Unused by the resolver; the admin API needs it to edit. */
  id: string;
  categoryId: string;
  isRequired: boolean;
  sortOrder: number;
  section: string;
  showInCard: boolean;
  visibilityRule: unknown;
  overrides: unknown;
  field: RawFieldRow;
}

export interface ResolverInput {
  category: RawCategoryRow;
  /** Ancestors ordered root-first. Empty for a top-level category. */
  ancestors: RawCategoryRow[];
  /** Attachments for the category AND all of its ancestors, unordered. */
  attachments: RawCategoryFieldRow[];
}

function toSummary(row: RawCategoryRow): CategorySummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    icon: row.icon,
  };
}

/** JSON columns are `unknown` at the boundary; coerce defensively. */
function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toValidation(base: unknown, overrides: unknown): ValidationConfig {
  return { ...asObject(base), ...asObject(overrides) } as ValidationConfig;
}

function toVisibilityRule(value: unknown): VisibilityRule | null {
  const rule = asObject(value);
  return Object.keys(rule).length > 0 ? (rule as VisibilityRule) : null;
}

function toOptions(rows: RawFieldOptionRow[]): FieldOptionDef[] {
  return rows
    .filter((option) => option.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    .map(({ value, label, sortOrder }) => ({ value, label, sortOrder }));
}

/**
 * Resolves a category's complete form schema.
 *
 * Inheritance: a child category receives every field attached to its ancestors.
 * When both a child and an ancestor attach the same field, the CHILD wins —
 * that is how "RAM is optional on Mobile Phone but required on Laptop" works
 * without duplicating the field definition.
 */
export function resolveFormSchema(input: ResolverInput): FormSchema {
  const { category, ancestors, attachments } = input;

  // Root-first, own category last, so later writes overwrite earlier ones.
  const precedence = [...ancestors.map((a) => a.id), category.id];
  const categoryById = new Map(ancestors.concat(category).map((row) => [row.id, row]));

  const byFieldId = new Map<string, { row: RawCategoryFieldRow; rank: number }>();

  for (const attachment of attachments) {
    if (!attachment.field.isActive) continue;

    const rank = precedence.indexOf(attachment.categoryId);
    if (rank === -1) continue; // Not part of this category's chain.

    const existing = byFieldId.get(attachment.field.id);
    if (!existing || rank >= existing.rank) {
      byFieldId.set(attachment.field.id, { row: attachment, rank });
    }
  }

  const fields: FieldDefinition[] = Array.from(byFieldId.values())
    .map(({ row }) => {
      const owner = row.categoryId === category.id ? null : categoryById.get(row.categoryId);
      return {
        fieldId: row.field.id,
        key: row.field.key,
        label: row.field.label,
        type: row.field.type,
        helpText: row.field.helpText,
        unit: row.field.unit,
        placeholder: row.field.placeholder,
        defaultValue: row.field.defaultValue,
        options: toOptions(row.field.options),
        validation: toValidation(row.field.validation, row.overrides),
        isRequired: row.isRequired,
        section: row.section?.trim() || 'Details',
        sortOrder: row.sortOrder,
        showInCard: row.showInCard,
        visibilityRule: toVisibilityRule(row.visibilityRule),
        inheritedFrom: owner ? { categoryId: owner.id, categoryName: owner.name } : null,
      } satisfies FieldDefinition;
    })
    // Stable ordering: sortOrder first, label as the tie-breaker so the form
    // never reshuffles between requests.
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

  return {
    category: toSummary(category),
    ancestors: ancestors.map(toSummary),
    sections: groupIntoSections(fields),
    fields,
  };
}

/** Groups by section, preserving the order in which sections first appear. */
function groupIntoSections(fields: FieldDefinition[]): FormSection[] {
  const sections: FormSection[] = [];
  const indexByTitle = new Map<string, number>();

  for (const field of fields) {
    const existingIndex = indexByTitle.get(field.section);
    if (existingIndex === undefined) {
      indexByTitle.set(field.section, sections.length);
      sections.push({ title: field.section, fields: [field] });
    } else {
      sections[existingIndex]?.fields.push(field);
    }
  }

  return sections;
}
