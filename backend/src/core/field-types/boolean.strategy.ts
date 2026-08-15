import { z, type ZodTypeAny } from 'zod';
import type { FieldDefinition } from '../types';
import type { FieldConfigDraft, FieldTypeStrategy } from './strategy';

const TRUTHY = new Set(['true', 'yes', 'on', '1']);
const FALSY = new Set(['false', 'no', 'off', '0']);

class BooleanStrategy implements FieldTypeStrategy {
  readonly type = 'BOOLEAN' as const;
  readonly label = 'Yes / No';
  readonly usesOptions = false;

  buildSchema(field: FieldDefinition): ZodTypeAny {
    return z.boolean({ invalid_type_error: `${field.label} must be yes or no.` });
  }

  /**
   * Note `z.coerce.boolean()` is deliberately avoided: it turns the string
   * "false" into `true`, which is exactly the value a form sends for "No".
   */
  normalize(raw: unknown): unknown {
    if (raw === undefined || raw === null || raw === '') return null;
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') return raw !== 0;
    const token = String(raw).trim().toLowerCase();
    if (TRUTHY.has(token)) return true;
    if (FALSY.has(token)) return false;
    return raw;
  }

  /**
   * `false` is an ANSWER, not a blank. Only an absent value is empty —
   * otherwise a required "Original box?" could never be answered "No".
   */
  isEmpty(value: unknown): boolean {
    return value === undefined || value === null || value === '';
  }

  validateConfig(draft: FieldConfigDraft): string[] {
    const { defaultValue } = draft;
    if (defaultValue !== null && defaultValue.trim() !== '') {
      const token = defaultValue.trim().toLowerCase();
      if (!TRUTHY.has(token) && !FALSY.has(token)) {
        return [`Field "${draft.label}" has a default value that is not a yes/no value.`];
      }
    }
    return [];
  }
}

export const booleanStrategy = new BooleanStrategy();
