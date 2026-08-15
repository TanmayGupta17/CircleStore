import { describe, expect, it } from 'vitest';
import { isVisible, resolveVisibility, ruleDependencies } from '../src/core/schema/visibility';
import { field } from './helpers';

describe('isVisible', () => {
  it('shows a field with no rule', () => {
    expect(isVisible(null, {})).toBe(true);
  });

  it('matches the brief: warranty expiry only when under warranty is yes', () => {
    const rule = { all: [{ field: 'under_warranty', op: 'eq' as const, value: 'yes' }] };

    expect(isVisible(rule, { under_warranty: 'yes' })).toBe(true);
    expect(isVisible(rule, { under_warranty: 'no' })).toBe(false);
    expect(isVisible(rule, {})).toBe(false);
  });

  it('compares a boolean answer against a rule authored as yes/no', () => {
    // Admins write rules in the UI's language; strategies store canonical types.
    const rule = { all: [{ field: 'original_box', op: 'eq' as const, value: 'yes' }] };

    expect(isVisible(rule, { original_box: true })).toBe(true);
    expect(isVisible(rule, { original_box: false })).toBe(false);
  });

  it('supports any / not / nested rules', () => {
    const rule = {
      any: [
        { field: 'brand', op: 'eq' as const, value: 'Apple' },
        { all: [{ field: 'ram', op: 'gte' as const, value: 8 }] },
      ],
    };

    expect(isVisible(rule, { brand: 'Apple', ram: 4 })).toBe(true);
    expect(isVisible(rule, { brand: 'Dell', ram: 16 })).toBe(true);
    expect(isVisible(rule, { brand: 'Dell', ram: 4 })).toBe(false);

    expect(isVisible({ not: { field: 'brand', op: 'eq', value: 'Apple' } }, { brand: 'Dell' })).toBe(true);
  });

  it('handles in / contains for multi-select answers', () => {
    expect(
      isVisible({ all: [{ field: 'accessories', op: 'contains', value: 'Charger' }] }, {
        accessories: ['Cable', 'Charger'],
      }),
    ).toBe(true);

    expect(
      isVisible({ all: [{ field: 'brand', op: 'in', value: ['Apple', 'Samsung'] }] }, { brand: 'Samsung' }),
    ).toBe(true);
  });

  it('compares numerically rather than lexicographically', () => {
    // String comparison would make "9" > "80"; the evaluator must not.
    const rule = { all: [{ field: 'battery_health', op: 'gt' as const, value: 80 }] };

    expect(isVisible(rule, { battery_health: 9 })).toBe(false);
    expect(isVisible(rule, { battery_health: 85 })).toBe(true);
  });

  it('fails open on an unknown operator so a bad rule cannot block a listing', () => {
    const rule = { all: [{ field: 'x', op: 'bogus' as never, value: 1 }] };
    expect(isVisible(rule, {})).toBe(true);
  });
});

describe('ruleDependencies', () => {
  it('collects every referenced key, including nested ones', () => {
    const rule = {
      all: [
        { field: 'a', op: 'eq' as const, value: 1 },
        { any: [{ field: 'b', op: 'truthy' as const }, { not: { field: 'c', op: 'falsy' as const } }] },
      ],
    };

    expect(ruleDependencies(rule).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('resolveVisibility', () => {
  const underWarranty = field({ key: 'under_warranty', sortOrder: 0 });
  const expiry = field({
    key: 'warranty_expiry',
    sortOrder: 1,
    visibilityRule: { all: [{ field: 'under_warranty', op: 'eq', value: 'yes' }] },
  });

  it('strips the value of a hidden field', () => {
    // The classic bug: seller answers "yes", fills the date, then switches to
    // "no". The stale date must not be persisted.
    const result = resolveVisibility([underWarranty, expiry], {
      under_warranty: 'no',
      warranty_expiry: '2026-01-01',
    });

    expect(result.hiddenKeys).toEqual(['warranty_expiry']);
    expect(result.effectiveValues).toEqual({ under_warranty: 'no' });
  });

  it('keeps the value when the field is shown', () => {
    const result = resolveVisibility([underWarranty, expiry], {
      under_warranty: 'yes',
      warranty_expiry: '2026-01-01',
    });

    expect(result.hiddenKeys).toEqual([]);
    expect(result.effectiveValues.warranty_expiry).toBe('2026-01-01');
  });

  it('cascades: hiding a controlling field also hides what depends on it', () => {
    const hasWarrantyBlock = field({ key: 'has_block', sortOrder: 0 });
    const controlling = field({
      key: 'under_warranty',
      sortOrder: 1,
      visibilityRule: { all: [{ field: 'has_block', op: 'eq', value: 'yes' }] },
    });
    const dependent = field({
      key: 'warranty_expiry',
      sortOrder: 2,
      visibilityRule: { all: [{ field: 'under_warranty', op: 'eq', value: 'yes' }] },
    });

    const result = resolveVisibility([hasWarrantyBlock, controlling, dependent], {
      has_block: 'no',
      under_warranty: 'yes',
      warranty_expiry: '2026-01-01',
    });

    expect(result.hiddenKeys).toEqual(['under_warranty', 'warranty_expiry']);
    expect(result.effectiveValues).toEqual({ has_block: 'no' });
  });
});
