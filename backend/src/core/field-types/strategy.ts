import type { ZodTypeAny } from 'zod';
import type { FieldDefinition, FieldType, FieldOptionDef, ValidationConfig } from '../types';

/**
 * A field type's configuration as an admin drafts it, before it is persisted.
 * Narrower than `FieldDefinition` because per-category config does not exist yet.
 */
export interface FieldConfigDraft {
  type: FieldType;
  key: string;
  label: string;
  validation: ValidationConfig;
  options: Pick<FieldOptionDef, 'value' | 'label'>[];
  defaultValue: string | null;
}

/**
 * One strategy per field type. This is the extension point of the whole system:
 * supporting a new input type means adding one file and one registry entry —
 * no existing file is modified (Open/Closed).
 *
 * Deliberately narrow (Interface Segregation): these four concerns are all about
 * DATA INTEGRITY. Presentation lives in the frontend's own field registry, so
 * the backend never grows a dependency on how anything looks.
 */
export interface FieldTypeStrategy {
  readonly type: FieldType;

  /** Human-readable name, surfaced in the admin field-type picker. */
  readonly label: string;

  /** Whether this type requires `FieldOption` rows to be meaningful. */
  readonly usesOptions: boolean;

  /**
   * Zod schema validating a PRESENT (non-empty) value. Required/optional
   * handling lives in the validator, which uses `isEmpty` — that keeps every
   * strategy free of the same optional-wrapping boilerplate.
   */
  buildSchema(field: FieldDefinition): ZodTypeAny;

  /**
   * Coerce raw transport input into its canonical stored form. HTML inputs
   * submit everything as strings, so "89" must become 89 before it reaches JSONB
   * or every numeric filter downstream breaks.
   */
  normalize(raw: unknown, field: FieldDefinition): unknown;

  /** Whether a value counts as "not answered" for the required check. */
  isEmpty(value: unknown): boolean;

  /**
   * Validate an admin's field configuration. Returns human-readable problems;
   * an empty array means the configuration is usable.
   */
  validateConfig(draft: FieldConfigDraft): string[];
}

/** Active option values for a field, in order. */
export function optionValues(field: FieldDefinition): string[] {
  return field.options.map((o) => o.value);
}

/** Shared emptiness check for the scalar types. */
export function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

/** Options are mandatory for choice-based types, and their values must be unique. */
export function validateOptionSet(draft: FieldConfigDraft): string[] {
  const issues: string[] = [];
  if (draft.options.length === 0) {
    issues.push(`Field "${draft.label}" is of type ${draft.type} and needs at least one option.`);
    return issues;
  }
  const seen = new Set<string>();
  for (const option of draft.options) {
    if (option.value.trim() === '') {
      issues.push(`Field "${draft.label}" has an option with an empty value.`);
      continue;
    }
    if (seen.has(option.value)) {
      issues.push(`Field "${draft.label}" has duplicate option value "${option.value}".`);
    }
    seen.add(option.value);
  }
  return issues;
}

/** Guards against min > max style contradictions that would reject every input. */
export function validateRange(
  draft: FieldConfigDraft,
  lower: keyof ValidationConfig,
  upper: keyof ValidationConfig,
): string[] {
  const min = draft.validation[lower];
  const max = draft.validation[upper];
  if (typeof min === 'number' && typeof max === 'number' && min > max) {
    return [`Field "${draft.label}" has ${String(lower)} (${min}) greater than ${String(upper)} (${max}).`];
  }
  return [];
}
