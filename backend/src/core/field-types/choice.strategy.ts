import { z, type ZodTypeAny } from 'zod';
import type { FieldDefinition } from '../types';
import {
  isBlank,
  optionValues,
  validateOptionSet,
  type FieldConfigDraft,
  type FieldTypeStrategy,
} from './strategy';

/**
 * Single-choice types. SELECT and RADIO are the same data contract — pick one
 * of N — and differ only in presentation, so they share one implementation.
 */
class SingleChoiceStrategy implements FieldTypeStrategy {
  constructor(
    readonly type: 'SELECT' | 'RADIO',
    readonly label: string,
  ) {}

  readonly usesOptions = true;

  buildSchema(field: FieldDefinition): ZodTypeAny {
    const allowed = optionValues(field);
    return z.string().refine(
      (value) => allowed.includes(value),
      `${field.label} must be one of: ${field.options.map((o) => o.label).join(', ')}.`,
    );
  }

  normalize(raw: unknown): unknown {
    if (isBlank(raw)) return null;
    return String(raw).trim();
  }

  isEmpty(value: unknown): boolean {
    return isBlank(value);
  }

  validateConfig(draft: FieldConfigDraft): string[] {
    const issues = validateOptionSet(draft);
    const { defaultValue } = draft;
    if (defaultValue && !draft.options.some((o) => o.value === defaultValue)) {
      issues.push(`Field "${draft.label}" has a default value that is not one of its options.`);
    }
    return issues;
  }
}

/**
 * Multi-choice. Stored as an array of option values so the JSONB containment
 * operator can answer "which listings include this accessory".
 */
class MultiSelectStrategy implements FieldTypeStrategy {
  readonly type = 'MULTISELECT' as const;
  readonly label = 'Multi-select';
  readonly usesOptions = true;

  buildSchema(field: FieldDefinition): ZodTypeAny {
    const allowed = optionValues(field);
    const { minSelected, maxSelected } = field.validation;

    let schema: ZodTypeAny = z
      .array(z.string())
      .refine(
        (values) => values.every((v) => allowed.includes(v)),
        `${field.label} contains a choice that is no longer available.`,
      )
      .refine((values) => new Set(values).size === values.length, `${field.label} contains duplicate choices.`);

    if (typeof minSelected === 'number') {
      schema = schema.refine(
        (values: string[]) => values.length >= minSelected,
        `${field.label} requires at least ${minSelected} selection${minSelected === 1 ? '' : 's'}.`,
      );
    }
    if (typeof maxSelected === 'number') {
      schema = schema.refine(
        (values: string[]) => values.length <= maxSelected,
        `${field.label} allows at most ${maxSelected} selection${maxSelected === 1 ? '' : 's'}.`,
      );
    }
    return schema;
  }

  /** Tolerates a single scalar, which is what a form sends when one box is ticked. */
  normalize(raw: unknown): unknown {
    if (raw === undefined || raw === null || raw === '') return [];
    const list = Array.isArray(raw) ? raw : [raw];
    const cleaned = list
      .filter((v) => v !== undefined && v !== null && v !== '')
      .map((v) => String(v).trim());
    return Array.from(new Set(cleaned));
  }

  isEmpty(value: unknown): boolean {
    if (Array.isArray(value)) return value.length === 0;
    return isBlank(value);
  }

  validateConfig(draft: FieldConfigDraft): string[] {
    const issues = validateOptionSet(draft);
    const { minSelected, maxSelected } = draft.validation;
    if (typeof minSelected === 'number' && typeof maxSelected === 'number' && minSelected > maxSelected) {
      issues.push(`Field "${draft.label}" requires more selections than it allows.`);
    }
    if (typeof maxSelected === 'number' && maxSelected > draft.options.length) {
      issues.push(
        `Field "${draft.label}" allows up to ${maxSelected} selections but only has ${draft.options.length} options.`,
      );
    }
    return issues;
  }
}

export const selectStrategy = new SingleChoiceStrategy('SELECT', 'Dropdown');
export const radioStrategy = new SingleChoiceStrategy('RADIO', 'Radio buttons');
export const multiSelectStrategy = new MultiSelectStrategy();
