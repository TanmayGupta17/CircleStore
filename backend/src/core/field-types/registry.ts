import { FIELD_TYPES, type FieldType } from '../types';
import type { FieldTypeStrategy } from './strategy';
import { textStrategy, textareaStrategy } from './text.strategy';
import { numberStrategy } from './number.strategy';
import { selectStrategy, radioStrategy, multiSelectStrategy } from './choice.strategy';
import { booleanStrategy } from './boolean.strategy';
import { dateStrategy } from './date.strategy';

/**
 * The registry — the single place that maps a field type to its behaviour.
 *
 * `satisfies Record<FieldType, FieldTypeStrategy>` is load-bearing: adding a
 * value to the `FieldType` union without registering a strategy fails the build.
 * Extensibility is enforced by the compiler rather than by convention.
 *
 * Adding a new input type is therefore: write one strategy file, add one line
 * here, add the matching component to the frontend registry. No existing
 * validation, normalisation or persistence code is touched.
 */
const STRATEGIES = {
  TEXT: textStrategy,
  TEXTAREA: textareaStrategy,
  NUMBER: numberStrategy,
  SELECT: selectStrategy,
  MULTISELECT: multiSelectStrategy,
  RADIO: radioStrategy,
  BOOLEAN: booleanStrategy,
  DATE: dateStrategy,
} satisfies Record<FieldType, FieldTypeStrategy>;

export function getStrategy(type: FieldType): FieldTypeStrategy {
  const strategy = STRATEGIES[type];
  if (!strategy) {
    // Unreachable for valid FieldType values; guards against bad data read
    // from the database after a manual edit or a partially applied migration.
    throw new Error(`No field-type strategy registered for "${type}".`);
  }
  return strategy;
}

/** Field-type catalogue for the admin UI's type picker. */
export function listFieldTypes(): Array<{
  type: FieldType;
  label: string;
  usesOptions: boolean;
}> {
  return FIELD_TYPES.map((type) => {
    const strategy = getStrategy(type);
    return { type, label: strategy.label, usesOptions: strategy.usesOptions };
  });
}

export function typeUsesOptions(type: FieldType): boolean {
  return getStrategy(type).usesOptions;
}
