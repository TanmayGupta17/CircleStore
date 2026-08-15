import { describe, expect, it } from 'vitest';
import { validateAttributes } from '../src/core/schema/validator';
import { field, options, schema } from './helpers';

describe('validateAttributes — required and visibility', () => {
  it('reports a missing required field', () => {
    const result = validateAttributes(schema([field({ key: 'model', isRequired: true })]), {});
    expect(result.errors.model).toMatch(/required/i);
  });

  it('does NOT require a field that is hidden by its rule', () => {
    const form = schema([
      field({ key: 'under_warranty', sortOrder: 0 }),
      field({
        key: 'warranty_expiry',
        type: 'DATE',
        isRequired: true,
        sortOrder: 1,
        visibilityRule: { all: [{ field: 'under_warranty', op: 'eq', value: 'yes' }] },
      }),
    ]);

    const result = validateAttributes(form, { under_warranty: 'no' });

    expect(result.errors).toEqual({});
    expect(result.values.warranty_expiry).toBeUndefined();
  });

  it('requires the conditional field once it becomes visible', () => {
    const form = schema([
      field({ key: 'under_warranty', sortOrder: 0 }),
      field({
        key: 'warranty_expiry',
        type: 'DATE',
        isRequired: true,
        sortOrder: 1,
        visibilityRule: { all: [{ field: 'under_warranty', op: 'eq', value: 'yes' }] },
      }),
    ]);

    const result = validateAttributes(form, { under_warranty: 'yes' });
    expect(result.errors.warranty_expiry).toMatch(/required/i);
  });

  it('drops keys that are not part of the schema', () => {
    const result = validateAttributes(schema([field({ key: 'model' })]), {
      model: 'iPhone',
      injected: 'should not persist',
    });

    expect(result.values).toEqual({ model: 'iPhone' });
  });
});

describe('validateAttributes — normalisation', () => {
  it('coerces numeric strings so filters and comparisons work', () => {
    const form = schema([field({ key: 'battery_health', type: 'NUMBER' })]);
    const result = validateAttributes(form, { battery_health: '89' });

    expect(result.values.battery_health).toBe(89);
    expect(typeof result.values.battery_health).toBe('number');
  });

  it('treats the string "false" as false, not truthy', () => {
    const form = schema([field({ key: 'original_box', type: 'BOOLEAN' })]);
    const result = validateAttributes(form, { original_box: 'false' });

    expect(result.values.original_box).toBe(false);
  });

  it('accepts a boolean "No" answer for a required field', () => {
    // `false` is an answer, not a blank.
    const form = schema([field({ key: 'original_box', type: 'BOOLEAN', isRequired: true })]);
    const result = validateAttributes(form, { original_box: false });

    expect(result.errors).toEqual({});
    expect(result.values.original_box).toBe(false);
  });

  it('wraps a single multi-select value into an array', () => {
    const form = schema([
      field({ key: 'accessories', type: 'MULTISELECT', options: options('charger', 'cable') }),
    ]);
    const result = validateAttributes(form, { accessories: 'charger' });

    expect(result.values.accessories).toEqual(['charger']);
  });

  it('applies a configured default when the seller leaves a field untouched', () => {
    const form = schema([field({ key: 'under_warranty', defaultValue: 'no' })]);
    const result = validateAttributes(form, {});

    expect(result.values.under_warranty).toBe('no');
  });
});

describe('validateAttributes — per-type rules', () => {
  it('enforces numeric min/max', () => {
    const form = schema([
      field({ key: 'battery_health', type: 'NUMBER', validation: { min: 0, max: 100 } }),
    ]);

    expect(validateAttributes(form, { battery_health: 150 }).errors.battery_health).toMatch(/at most 100/);
    expect(validateAttributes(form, { battery_health: 89 }).errors).toEqual({});
  });

  it('rejects a non-numeric value for a NUMBER field', () => {
    const form = schema([field({ key: 'battery_health', type: 'NUMBER' })]);
    expect(validateAttributes(form, { battery_health: 'abc' }).errors.battery_health).toBeDefined();
  });

  it('enforces text length', () => {
    const form = schema([field({ key: 'model', validation: { minLength: 3, maxLength: 5 } })]);

    expect(validateAttributes(form, { model: 'ab' }).errors.model).toMatch(/at least 3/);
    expect(validateAttributes(form, { model: 'abcdef' }).errors.model).toMatch(/at most 5/);
  });

  it('rejects a choice that is not an available option', () => {
    const form = schema([
      field({ key: 'brand', type: 'SELECT', options: options('apple', 'samsung') }),
    ]);

    expect(validateAttributes(form, { brand: 'nokia' }).errors.brand).toBeDefined();
    expect(validateAttributes(form, { brand: 'apple' }).errors).toEqual({});
  });

  it('rejects an impossible calendar date that passes the regex', () => {
    const form = schema([field({ key: 'purchase_date', type: 'DATE' })]);
    expect(validateAttributes(form, { purchase_date: '2024-02-31' }).errors.purchase_date).toBeDefined();
  });

  it('enforces multi-select bounds', () => {
    const form = schema([
      field({
        key: 'accessories',
        type: 'MULTISELECT',
        options: options('a', 'b', 'c'),
        validation: { maxSelected: 2 },
      }),
    ]);

    expect(validateAttributes(form, { accessories: ['a', 'b', 'c'] }).errors.accessories).toMatch(/at most 2/);
  });
});
