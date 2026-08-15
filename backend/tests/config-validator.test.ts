import { describe, expect, it } from 'vitest';
import { validateCategoryConfig } from '../src/core/schema/config-validator';
import { getStrategy, listFieldTypes } from '../src/core/field-types/registry';
import { FIELD_TYPES } from '../src/core/types';
import { buildSnapshot } from '../src/core/schema/snapshot';
import { field, options } from './helpers';

describe('validateCategoryConfig', () => {
  it('accepts a well-formed configuration', () => {
    const issues = validateCategoryConfig([
      field({ key: 'under_warranty', sortOrder: 0 }),
      field({
        key: 'warranty_expiry',
        type: 'DATE',
        sortOrder: 1,
        visibilityRule: { all: [{ field: 'under_warranty', op: 'eq', value: 'yes' }] },
      }),
    ]);

    expect(issues).toEqual([]);
  });

  it('rejects a circular rule that would hide both fields forever', () => {
    const issues = validateCategoryConfig([
      field({ key: 'a', sortOrder: 0, visibilityRule: { all: [{ field: 'b', op: 'truthy' }] } }),
      field({ key: 'b', sortOrder: 1, visibilityRule: { all: [{ field: 'a', op: 'truthy' }] } }),
    ]);

    expect(issues.some((issue) => /circular/i.test(issue))).toBe(true);
  });

  it('rejects a rule pointing at a field that appears later in the form', () => {
    const issues = validateCategoryConfig([
      field({
        key: 'warranty_expiry',
        sortOrder: 0,
        visibilityRule: { all: [{ field: 'under_warranty', op: 'eq', value: 'yes' }] },
      }),
      field({ key: 'under_warranty', sortOrder: 1 }),
    ]);

    expect(issues.some((issue) => /ordered before/i.test(issue))).toBe(true);
  });

  it('rejects a rule depending on a field that is not attached', () => {
    const issues = validateCategoryConfig([
      field({
        key: 'warranty_expiry',
        sortOrder: 0,
        visibilityRule: { all: [{ field: 'missing_field', op: 'eq', value: 'yes' }] },
      }),
    ]);

    expect(issues.some((issue) => /not attached/i.test(issue))).toBe(true);
  });

  it('rejects a choice field with no options', () => {
    const issues = validateCategoryConfig([field({ key: 'brand', type: 'SELECT' })]);
    expect(issues.some((issue) => /at least one option/i.test(issue))).toBe(true);
  });

  it('rejects a default value that is not one of the options', () => {
    const issues = validateCategoryConfig([
      field({ key: 'brand', type: 'SELECT', options: options('apple'), defaultValue: 'nokia' }),
    ]);

    expect(issues.some((issue) => /default value/i.test(issue))).toBe(true);
  });

  it('rejects contradictory bounds that would reject every input', () => {
    const issues = validateCategoryConfig([
      field({ key: 'battery_health', type: 'NUMBER', validation: { min: 100, max: 10 } }),
    ]);

    expect(issues.some((issue) => /greater than/i.test(issue))).toBe(true);
  });
});

describe('field-type registry', () => {
  it('has a strategy for every declared field type', () => {
    // The compiler enforces this via `satisfies`; the test guards the runtime
    // lookup path too, since types can arrive from the database.
    for (const type of FIELD_TYPES) {
      expect(getStrategy(type).type).toBe(type);
    }
    expect(listFieldTypes()).toHaveLength(FIELD_TYPES.length);
  });
});

describe('buildSnapshot', () => {
  it('captures only visible fields that were actually answered', () => {
    const brand = field({ key: 'brand', type: 'SELECT', options: options('apple'), sortOrder: 0 });
    const model = field({ key: 'model', sortOrder: 1 });

    const snapshot = buildSnapshot([brand, model], { brand: 'apple' });

    expect(snapshot.map((entry) => entry.key)).toEqual(['brand']);
  });

  it('freezes option labels so a later rename cannot rewrite history', () => {
    const brand = field({ key: 'brand', type: 'SELECT', options: options('apple') });
    const snapshot = buildSnapshot([brand], { brand: 'apple' });

    expect(snapshot[0]?.options).toEqual([{ value: 'apple', label: 'APPLE' }]);
  });

  it('omits options for types that do not use them', () => {
    const snapshot = buildSnapshot([field({ key: 'model' })], { model: 'iPhone' });
    expect(snapshot[0]?.options).toBeUndefined();
  });
});
