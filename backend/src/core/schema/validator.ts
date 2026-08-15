import { getStrategy } from '../field-types/registry';
import type { FieldErrors } from '../errors';
import type { AttributeValues, FieldDefinition, FormSchema } from '../types';
import { applyDefaults, normalizeAttributes, stripUnknownKeys } from './normalize';
import { resolveVisibility } from './visibility';

export interface AttributeValidationResult {
  /** Clean, normalised, hidden-stripped values ready to persist. */
  values: AttributeValues;
  /** Keyed by `Field.key` so the client can map them straight onto inputs. */
  errors: FieldErrors;
  /** Fields the rules hid; their values were discarded. */
  hiddenKeys: string[];
  /** Fields actually shown, used to build the snapshot. */
  visibleFields: FieldDefinition[];
}

export function hasErrors(result: AttributeValidationResult): boolean {
  return Object.keys(result.errors).length > 0;
}

/**
 * Validates a listing's category-specific answers against a resolved schema.
 *
 * The pipeline, in this exact order:
 *   1. strip keys not in the schema      — reject junk and stale category data
 *   2. normalise                         — "89" -> 89, "no" -> false
 *   3. apply defaults                    — so defaults can drive conditionals
 *   4. resolve visibility                — cascading, strips hidden values
 *   5. required check on visible fields  — a hidden field is never required
 *   6. per-field schema validation       — delegated to the type's strategy
 *
 * This is the server's own authority. The client runs equivalent logic for UX,
 * but nothing here trusts it.
 */
export function validateAttributes(
  schema: FormSchema,
  raw: AttributeValues,
): AttributeValidationResult {
  const fields = schema.fields;

  const known = stripUnknownKeys(fields, raw ?? {});
  const normalized = normalizeAttributes(fields, known);
  const withDefaults = applyDefaults(fields, normalized);

  const { visible, hiddenKeys, effectiveValues } = resolveVisibility(fields, withDefaults);

  const errors: FieldErrors = {};
  const values: AttributeValues = {};

  for (const field of visible) {
    const strategy = getStrategy(field.type);
    const value = effectiveValues[field.key];

    if (strategy.isEmpty(value)) {
      if (field.isRequired) {
        errors[field.key] = `${field.label} is required.`;
      }
      continue; // Absent optional answers are simply not stored.
    }

    const parsed = strategy.buildSchema(field).safeParse(value);
    if (parsed.success) {
      values[field.key] = parsed.data;
    } else {
      errors[field.key] = firstIssueMessage(parsed.error, field);
    }
  }

  return { values, errors, hiddenKeys, visibleFields: visible };
}

/** One message per field — the UI shows a single error under each input. */
function firstIssueMessage(error: { issues: Array<{ message: string }> }, field: FieldDefinition): string {
  const first = error.issues[0];
  return first?.message ?? `${field.label} is invalid.`;
}
