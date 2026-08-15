import { getStrategy } from '../field-types/registry';
import type { FieldConfigDraft } from '../field-types/strategy';
import type { FieldDefinition } from '../types';
import { ruleDependencies } from './visibility';

/**
 * Guards against category configurations that would produce a broken form.
 *
 * Admin-authored conditional rules are effectively user-supplied control flow,
 * so they get the same treatment as code: reject at write time rather than
 * discover at seller time. Every check here runs before a category's field
 * configuration is saved.
 */
export function validateCategoryConfig(fields: FieldDefinition[]): string[] {
  const issues: string[] = [];

  issues.push(...findDuplicateKeys(fields));
  issues.push(...validateEachField(fields));
  issues.push(...findDanglingDependencies(fields));
  issues.push(...findCycles(fields));
  issues.push(...findForwardReferences(fields));

  return issues;
}

function findDuplicateKeys(fields: FieldDefinition[]): string[] {
  const seen = new Set<string>();
  const issues: string[] = [];

  for (const field of fields) {
    if (seen.has(field.key)) {
      issues.push(`Field key "${field.key}" is attached to this category more than once.`);
    }
    seen.add(field.key);
  }

  return issues;
}

function validateEachField(fields: FieldDefinition[]): string[] {
  return fields.flatMap((field) =>
    getStrategy(field.type).validateConfig(toDraft(field)),
  );
}

export function toDraft(field: FieldDefinition): FieldConfigDraft {
  return {
    type: field.type,
    key: field.key,
    label: field.label,
    validation: field.validation,
    options: field.options.map(({ value, label }) => ({ value, label })),
    defaultValue: field.defaultValue,
  };
}

/**
 * A rule may only reference fields present in the same form. Detaching the
 * controlling field would otherwise leave a dependent field permanently hidden.
 */
function findDanglingDependencies(fields: FieldDefinition[]): string[] {
  const present = new Set(fields.map((field) => field.key));
  const issues: string[] = [];

  for (const field of fields) {
    for (const dependency of ruleDependencies(field.visibilityRule)) {
      if (!present.has(dependency)) {
        issues.push(
          `"${field.label}" has a rule depending on "${dependency}", which is not attached to this category.`,
        );
      }
    }
  }

  return issues;
}

/**
 * Detects `A shows if B` / `B shows if A`, which would leave both fields
 * permanently hidden and unfillable.
 */
function findCycles(fields: FieldDefinition[]): string[] {
  const graph = new Map<string, string[]>();
  const labels = new Map<string, string>();

  for (const field of fields) {
    graph.set(field.key, ruleDependencies(field.visibilityRule));
    labels.set(field.key, field.label);
  }

  const VISITING = 1;
  const DONE = 2;
  const state = new Map<string, number>();
  const issues: string[] = [];
  const stack: string[] = [];

  const visit = (key: string): void => {
    const current = state.get(key);
    if (current === DONE) return;

    if (current === VISITING) {
      const cycleStart = stack.indexOf(key);
      const cycle = stack
        .slice(cycleStart === -1 ? 0 : cycleStart)
        .concat(key)
        .map((k) => labels.get(k) ?? k);
      issues.push(`Circular conditional rule: ${cycle.join(' -> ')}.`);
      return;
    }

    state.set(key, VISITING);
    stack.push(key);
    for (const dependency of graph.get(key) ?? []) {
      if (graph.has(dependency)) visit(dependency);
    }
    stack.pop();
    state.set(key, DONE);
  };

  for (const key of graph.keys()) visit(key);

  // A cycle is reported once per entry point; collapse to distinct messages.
  return Array.from(new Set(issues));
}

/**
 * A field may only depend on one that appears EARLIER in the form.
 *
 * Two reasons: the seller must answer the controlling question before the
 * dependent one appears, and the single forward pass in `resolveVisibility`
 * relies on this ordering to cascade correctly.
 */
function findForwardReferences(fields: FieldDefinition[]): string[] {
  const positionByKey = new Map(fields.map((field, index) => [field.key, index]));
  const issues: string[] = [];

  fields.forEach((field, index) => {
    for (const dependency of ruleDependencies(field.visibilityRule)) {
      const dependencyIndex = positionByKey.get(dependency);
      if (dependencyIndex === undefined) continue; // Reported as dangling already.

      if (dependencyIndex >= index) {
        issues.push(
          `"${field.label}" depends on "${dependency}", which must be ordered before it in the form.`,
        );
      }
    }
  });

  return issues;
}

/** Validates a single field's own configuration, independent of any category. */
export function validateFieldDraft(draft: FieldConfigDraft): string[] {
  return getStrategy(draft.type).validateConfig(draft);
}
