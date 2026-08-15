import type { FieldDefinition, FieldType, FormSchema } from '../src/core/types';

/**
 * Fixture builders.
 *
 * The whole schema engine is pure, so tests construct plain objects — no
 * database, no HTTP, no mocks. That is the practical payoff of keeping
 * `src/core` free of I/O.
 */

let sequence = 0;

export function field(overrides: Partial<FieldDefinition> & { key: string }): FieldDefinition {
  sequence += 1;
  return {
    fieldId: `field-${sequence}`,
    key: overrides.key,
    label: overrides.label ?? overrides.key,
    type: (overrides.type ?? 'TEXT') as FieldType,
    helpText: null,
    unit: null,
    placeholder: null,
    defaultValue: null,
    options: [],
    validation: {},
    isRequired: false,
    section: 'Details',
    sortOrder: sequence,
    showInCard: false,
    visibilityRule: null,
    inheritedFrom: null,
    ...overrides,
  };
}

export function options(...values: string[]) {
  return values.map((value, index) => ({ value, label: value.toUpperCase(), sortOrder: index }));
}

export function schema(fields: FieldDefinition[]): FormSchema {
  return {
    category: { id: 'cat-1', name: 'Test', slug: 'test', description: null, icon: null },
    ancestors: [],
    sections: [{ title: 'Details', fields }],
    fields,
  };
}
