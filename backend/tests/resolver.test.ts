import { describe, expect, it } from 'vitest';
import {
  resolveFormSchema,
  type RawCategoryFieldRow,
  type RawCategoryRow,
} from '../src/core/schema/resolver';
import type { FieldType } from '../src/core/types';

const electronics: RawCategoryRow = {
  id: 'cat-electronics', name: 'Electronics', slug: 'electronics',
  description: null, icon: null, parentId: null,
};

const phone: RawCategoryRow = {
  id: 'cat-phone', name: 'Mobile Phone', slug: 'mobile-phone',
  description: null, icon: null, parentId: 'cat-electronics',
};

function attachment(
  categoryId: string,
  fieldId: string,
  key: string,
  overrides: Partial<RawCategoryFieldRow> = {},
  fieldOverrides: Partial<RawCategoryFieldRow['field']> = {},
): RawCategoryFieldRow {
  return {
    id: `attach-${categoryId}-${fieldId}`,
    categoryId,
    isRequired: false,
    sortOrder: 0,
    section: 'Details',
    showInCard: false,
    visibilityRule: null,
    overrides: null,
    field: {
      id: fieldId,
      key,
      label: key,
      type: 'TEXT' as FieldType,
      helpText: null,
      unit: null,
      placeholder: null,
      defaultValue: null,
      validation: {},
      isActive: true,
      options: [],
      ...fieldOverrides,
    },
    ...overrides,
  };
}

describe('resolveFormSchema', () => {
  it('inherits fields from ancestor categories', () => {
    const result = resolveFormSchema({
      category: phone,
      ancestors: [electronics],
      attachments: [
        attachment('cat-electronics', 'f-warranty', 'under_warranty'),
        attachment('cat-phone', 'f-brand', 'brand'),
      ],
    });

    expect(result.fields.map((f) => f.key).sort()).toEqual(['brand', 'under_warranty']);
  });

  it('marks inherited fields with their source category', () => {
    const result = resolveFormSchema({
      category: phone,
      ancestors: [electronics],
      attachments: [attachment('cat-electronics', 'f-warranty', 'under_warranty')],
    });

    expect(result.fields[0]?.inheritedFrom).toEqual({
      categoryId: 'cat-electronics',
      categoryName: 'Electronics',
    });
  });

  it('lets the child category override an ancestor attachment', () => {
    // "RAM is optional on the parent but required here" — configured on the
    // join table, without duplicating the field definition.
    const result = resolveFormSchema({
      category: phone,
      ancestors: [electronics],
      attachments: [
        attachment('cat-electronics', 'f-ram', 'ram', { isRequired: false }),
        attachment('cat-phone', 'f-ram', 'ram', { isRequired: true }),
      ],
    });

    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]?.isRequired).toBe(true);
    expect(result.fields[0]?.inheritedFrom).toBeNull();
  });

  it('merges per-category overrides on top of base validation', () => {
    const result = resolveFormSchema({
      category: phone,
      ancestors: [],
      attachments: [
        attachment(
          'cat-phone', 'f-model', 'model',
          { overrides: { maxLength: 40 } },
          { validation: { minLength: 2, maxLength: 100 } },
        ),
      ],
    });

    expect(result.fields[0]?.validation).toEqual({ minLength: 2, maxLength: 40 });
  });

  it('excludes deactivated fields and deactivated options', () => {
    const result = resolveFormSchema({
      category: phone,
      ancestors: [],
      attachments: [
        attachment('cat-phone', 'f-dead', 'retired', {}, { isActive: false }),
        attachment('cat-phone', 'f-brand', 'brand', {}, {
          type: 'SELECT' as FieldType,
          options: [
            { value: 'apple', label: 'Apple', sortOrder: 0, isActive: true },
            { value: 'nokia', label: 'Nokia', sortOrder: 1, isActive: false },
          ],
        }),
      ],
    });

    expect(result.fields.map((f) => f.key)).toEqual(['brand']);
    expect(result.fields[0]?.options.map((o) => o.value)).toEqual(['apple']);
  });

  it('orders by sortOrder and groups into sections in first-appearance order', () => {
    const result = resolveFormSchema({
      category: phone,
      ancestors: [],
      attachments: [
        attachment('cat-phone', 'f-c', 'c', { sortOrder: 2, section: 'Condition' }),
        attachment('cat-phone', 'f-a', 'a', { sortOrder: 0, section: 'Specs' }),
        attachment('cat-phone', 'f-b', 'b', { sortOrder: 1, section: 'Specs' }),
      ],
    });

    expect(result.fields.map((f) => f.key)).toEqual(['a', 'b', 'c']);
    expect(result.sections.map((s) => s.title)).toEqual(['Specs', 'Condition']);
    expect(result.sections[0]?.fields).toHaveLength(2);
  });
});
