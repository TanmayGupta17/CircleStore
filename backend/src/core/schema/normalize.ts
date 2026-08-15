import { getStrategy } from '../field-types/registry';
import type { AttributeValues, FieldDefinition } from '../types';

/**
 * Coercion of raw transport values into their canonical stored form.
 *
 * Runs BEFORE validation and before visibility evaluation. Ordering matters:
 * a rule written as `battery_health > 80` can only be evaluated once "85" has
 * become 85, and `under_warranty eq "yes"` needs the boolean coercion to have
 * happened first.
 */
export function normalizeAttributes(
  fields: FieldDefinition[],
  raw: AttributeValues,
): AttributeValues {
  const normalized: AttributeValues = {};

  for (const field of fields) {
    // Attributes absent from the payload stay absent, so `applyDefaults` can
    // tell "not supplied" apart from "explicitly cleared".
    if (!(field.key in raw)) continue;
    normalized[field.key] = getStrategy(field.type).normalize(raw[field.key], field);
  }

  return normalized;
}

/**
 * Fills in configured defaults for fields the seller left untouched.
 *
 * Applied before visibility so a default can itself drive a conditional rule.
 */
export function applyDefaults(fields: FieldDefinition[], values: AttributeValues): AttributeValues {
  const withDefaults: AttributeValues = { ...values };

  for (const field of fields) {
    if (field.defaultValue === null || field.defaultValue === '') continue;

    const strategy = getStrategy(field.type);
    if (!strategy.isEmpty(withDefaults[field.key])) continue;

    withDefaults[field.key] = strategy.normalize(field.defaultValue, field);
  }

  return withDefaults;
}

/**
 * Drops keys that no longer belong to the category's schema.
 *
 * Protects against a client posting arbitrary JSON into the attributes column,
 * and against stale keys left over when a seller switches category mid-form.
 */
export function stripUnknownKeys(
  fields: FieldDefinition[],
  values: AttributeValues,
): AttributeValues {
  const allowed = new Set(fields.map((field) => field.key));
  const filtered: AttributeValues = {};

  for (const [key, value] of Object.entries(values)) {
    if (allowed.has(key)) filtered[key] = value;
  }

  return filtered;
}
