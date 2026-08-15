import type { FieldDefinition } from './types';
import { visibleFields } from './visibility';

/**
 * Client-side validation for immediate feedback.
 *
 * This is a UX convenience ONLY. The server re-validates everything against the
 * database's field definitions and is the sole authority — see
 * `backend/src/core/schema/validator.ts`. Anything this misses is still caught
 * on submit and surfaced through the API's `fieldErrors`.
 */

export function isEmpty(field: FieldDefinition, value: unknown): boolean {
  if (field.type === 'MULTISELECT') return !Array.isArray(value) || value.length === 0;
  // `false` is a valid answer for a yes/no field, not a blank.
  if (field.type === 'BOOLEAN') return value === undefined || value === null || value === '';
  return value === undefined || value === null || String(value).trim() === '';
}

function validateOne(field: FieldDefinition, value: unknown): string | null {
  if (isEmpty(field, value)) {
    return field.isRequired ? `${field.label} is required.` : null;
  }

  const { validation } = field;

  if (field.type === 'NUMBER') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return `${field.label} must be a number.`;
    if (typeof validation.min === 'number' && numeric < validation.min) {
      return `${field.label} must be at least ${validation.min}${field.unit ? ` ${field.unit}` : ''}.`;
    }
    if (typeof validation.max === 'number' && numeric > validation.max) {
      return `${field.label} must be at most ${validation.max}${field.unit ? ` ${field.unit}` : ''}.`;
    }
  }

  if (field.type === 'TEXT' || field.type === 'TEXTAREA') {
    const text = String(value);
    if (validation.minLength !== undefined && text.length < validation.minLength) {
      return `${field.label} must be at least ${validation.minLength} characters.`;
    }
    if (validation.maxLength !== undefined && text.length > validation.maxLength) {
      return `${field.label} must be at most ${validation.maxLength} characters.`;
    }
  }

  if (field.type === 'MULTISELECT' && Array.isArray(value)) {
    if (validation.minSelected !== undefined && value.length < validation.minSelected) {
      return `${field.label} requires at least ${validation.minSelected} selection(s).`;
    }
    if (validation.maxSelected !== undefined && value.length > validation.maxSelected) {
      return `${field.label} allows at most ${validation.maxSelected} selection(s).`;
    }
  }

  if (field.type === 'DATE') {
    const text = String(value);
    if (typeof validation.min === 'string' && text < validation.min) {
      return `${field.label} must be on or after ${validation.min}.`;
    }
    if (typeof validation.max === 'string' && text > validation.max) {
      return `${field.label} must be on or before ${validation.max}.`;
    }
  }

  return null;
}

/** Validates only the fields the seller can currently see. */
export function validateAttributes(
  fields: FieldDefinition[],
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of visibleFields(fields, values)) {
    const message = validateOne(field, values[field.key]);
    if (message) errors[field.key] = message;
  }

  return errors;
}

/**
 * Removes answers for fields that are currently hidden.
 *
 * Mirrors the server's stripping step so the payload the seller submits matches
 * what they can actually see — the "Under warranty: No" + stale expiry-date bug.
 */
export function stripHidden(
  fields: FieldDefinition[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const visible = new Set(visibleFields(fields, values).map((field) => field.key));
  const cleaned: Record<string, unknown> = {};

  for (const field of fields) {
    if (!visible.has(field.key)) continue;
    const value = values[field.key];
    if (!isEmpty(field, value)) cleaned[field.key] = value;
  }

  return cleaned;
}
