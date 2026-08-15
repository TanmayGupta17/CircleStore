import { z, type ZodTypeAny } from 'zod';
import type { FieldDefinition } from '../types';
import {
  isBlank,
  validateRange,
  type FieldConfigDraft,
  type FieldTypeStrategy,
} from './strategy';

class NumberStrategy implements FieldTypeStrategy {
  readonly type = 'NUMBER' as const;
  readonly label = 'Number';
  readonly usesOptions = false;

  buildSchema(field: FieldDefinition): ZodTypeAny {
    const { min, max, step } = field.validation;

    let schema = z
      .number({ invalid_type_error: `${field.label} must be a number.` })
      .finite(`${field.label} must be a number.`);

    if (typeof min === 'number') {
      schema = schema.min(min, `${field.label} must be at least ${min}${suffix(field)}.`);
    }
    if (typeof max === 'number') {
      schema = schema.max(max, `${field.label} must be at most ${max}${suffix(field)}.`);
    }
    if (typeof step === 'number' && step > 0) {
      const base = typeof min === 'number' ? min : 0;
      return schema.refine(
        (value) => isMultipleOf(value - base, step),
        `${field.label} must be in increments of ${step}.`,
      );
    }
    return schema;
  }

  /**
   * HTML number inputs still submit strings, so coercion happens here rather
   * than in Zod — that way an unparseable value surfaces as a validation error
   * instead of a silent NaN reaching the database.
   */
  normalize(raw: unknown): unknown {
    if (isBlank(raw)) return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    const parsed = Number(String(raw).trim());
    return Number.isFinite(parsed) ? parsed : String(raw).trim();
  }

  isEmpty(value: unknown): boolean {
    return isBlank(value);
  }

  validateConfig(draft: FieldConfigDraft): string[] {
    const issues = validateRange(draft, 'min', 'max');
    const { step } = draft.validation;
    if (typeof step === 'number' && step <= 0) {
      issues.push(`Field "${draft.label}" has a step of ${step}; it must be greater than zero.`);
    }
    if (draft.defaultValue !== null && draft.defaultValue.trim() !== '' && !Number.isFinite(Number(draft.defaultValue))) {
      issues.push(`Field "${draft.label}" has a non-numeric default value.`);
    }
    return issues;
  }
}

function suffix(field: FieldDefinition): string {
  return field.unit ? ` ${field.unit}` : '';
}

/** Avoids the floating-point noise of a naive `value % step`. */
function isMultipleOf(value: number, step: number): boolean {
  const ratio = value / step;
  return Math.abs(ratio - Math.round(ratio)) < 1e-9;
}

export const numberStrategy = new NumberStrategy();
