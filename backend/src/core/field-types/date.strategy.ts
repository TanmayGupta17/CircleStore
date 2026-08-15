import { z, type ZodTypeAny } from 'zod';
import type { FieldDefinition } from '../types';
import { isBlank, type FieldConfigDraft, type FieldTypeStrategy } from './strategy';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Dates are stored as `YYYY-MM-DD` strings rather than JS Dates.
 *
 * A listing date ("purchase date", "warranty expiry") is a calendar date, not an
 * instant. Storing a timestamp would drag timezones in and let a date shift by a
 * day depending on who reads it. `min`/`max` are ISO date strings, which compare
 * correctly with plain string comparison.
 */
class DateStrategy implements FieldTypeStrategy {
  readonly type = 'DATE' as const;
  readonly label = 'Date';
  readonly usesOptions = false;

  buildSchema(field: FieldDefinition): ZodTypeAny {
    const min = asIsoDate(field.validation.min);
    const max = asIsoDate(field.validation.max);

    let schema: ZodTypeAny = z
      .string()
      .regex(ISO_DATE, `${field.label} must be a valid date.`)
      .refine(isRealCalendarDate, `${field.label} must be a valid date.`);

    if (min) {
      schema = schema.refine((value: string) => value >= min, `${field.label} must be on or after ${min}.`);
    }
    if (max) {
      schema = schema.refine((value: string) => value <= max, `${field.label} must be on or before ${max}.`);
    }
    return schema;
  }

  normalize(raw: unknown): unknown {
    if (isBlank(raw)) return null;
    const text = String(raw).trim();
    // Accept a full ISO timestamp and reduce it to its calendar date.
    const datePart = text.includes('T') ? text.split('T')[0] : text;
    return datePart ?? text;
  }

  isEmpty(value: unknown): boolean {
    return isBlank(value);
  }

  validateConfig(draft: FieldConfigDraft): string[] {
    const issues: string[] = [];
    const min = asIsoDate(draft.validation.min);
    const max = asIsoDate(draft.validation.max);
    if (min && max && min > max) {
      issues.push(`Field "${draft.label}" has an earliest date after its latest date.`);
    }
    const { defaultValue } = draft;
    if (defaultValue && defaultValue.trim() !== '' && !ISO_DATE.test(defaultValue.trim())) {
      issues.push(`Field "${draft.label}" has a default value that is not a YYYY-MM-DD date.`);
    }
    return issues;
  }
}

/**
 * `min`/`max` are typed as numbers on ValidationConfig for the numeric types;
 * for dates admins supply ISO strings, so accept either and normalise.
 */
function asIsoDate(bound: unknown): string | null {
  if (typeof bound !== 'string') return null;
  const trimmed = bound.trim();
  return ISO_DATE.test(trimmed) && isRealCalendarDate(trimmed) ? trimmed : null;
}

/** Rejects impossible dates like 2024-02-31 that pass the regex. */
function isRealCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

export const dateStrategy = new DateStrategy();
