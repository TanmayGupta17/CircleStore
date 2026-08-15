import { z, type ZodTypeAny } from 'zod';
import type { FieldDefinition } from '../types';
import {
  isBlank,
  validateRange,
  type FieldConfigDraft,
  type FieldTypeStrategy,
} from './strategy';

/**
 * Shared implementation for the two free-text types. TEXT and TEXTAREA differ
 * only in how the frontend renders them, so the validation logic is written once
 * and parameterised rather than copy-pasted.
 */
class FreeTextStrategy implements FieldTypeStrategy {
  constructor(
    readonly type: 'TEXT' | 'TEXTAREA',
    readonly label: string,
  ) {}

  readonly usesOptions = false;

  buildSchema(field: FieldDefinition): ZodTypeAny {
    const { minLength, maxLength, pattern, patternMessage } = field.validation;

    let schema = z.string();
    if (typeof minLength === 'number') {
      schema = schema.min(minLength, `${field.label} must be at least ${minLength} characters.`);
    }
    if (typeof maxLength === 'number') {
      schema = schema.max(maxLength, `${field.label} must be at most ${maxLength} characters.`);
    }
    if (pattern) {
      // An admin-authored pattern must never crash the request path.
      try {
        schema = schema.regex(new RegExp(pattern), patternMessage ?? `${field.label} is not in the expected format.`);
      } catch {
        // Invalid regex is caught at configuration time; ignore it here.
      }
    }
    return schema;
  }

  normalize(raw: unknown): unknown {
    if (raw === undefined || raw === null) return null;
    const trimmed = String(raw).trim();
    return trimmed === '' ? null : trimmed;
  }

  isEmpty(value: unknown): boolean {
    return isBlank(value);
  }

  validateConfig(draft: FieldConfigDraft): string[] {
    const issues = validateRange(draft, 'minLength', 'maxLength');
    if (draft.validation.pattern) {
      try {
        new RegExp(draft.validation.pattern);
      } catch {
        issues.push(`Field "${draft.label}" has an invalid regular expression pattern.`);
      }
    }
    return issues;
  }
}

export const textStrategy = new FreeTextStrategy('TEXT', 'Text');
export const textareaStrategy = new FreeTextStrategy('TEXTAREA', 'Long text');
