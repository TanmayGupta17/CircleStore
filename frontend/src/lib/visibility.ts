import type { FieldDefinition, VisibilityCondition, VisibilityNode, VisibilityRule } from './types';

/**
 * Client-side mirror of the server's conditional-rule evaluator.
 *
 * IMPORTANT: this exists for UX only — to show and hide fields as the seller
 * types. The server re-runs its own evaluation on submit and is the sole
 * authority on what gets stored. This copy is deliberately kept a direct
 * translation of `backend/src/core/schema/visibility.ts`; the backend version is
 * the one covered by tests.
 *
 * The duplication is the cost of deploying frontend and backend independently.
 * A shared workspace package would remove it — see README "Known trade-offs".
 */

function isCondition(node: VisibilityNode): node is VisibilityCondition {
  return typeof (node as VisibilityCondition).field === 'string';
}

const TRUTHY_TOKENS = new Set(['true', 'yes', 'on', '1']);

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return false;
  if (typeof value === 'number') return value !== 0;
  if (Array.isArray(value)) return value.length > 0;
  return TRUTHY_TOKENS.has(String(value).trim().toLowerCase());
}

function sameValue(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (actual === undefined || actual === null) return false;
  if (typeof actual === 'boolean' || typeof expected === 'boolean') {
    return toBoolean(actual) === toBoolean(expected);
  }
  return String(actual) === String(expected);
}

function compare(actual: unknown, expected: unknown): number {
  const a = typeof actual === 'number' ? actual : Number(String(actual));
  const b = typeof expected === 'number' ? expected : Number(String(expected));
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    const sa = String(actual);
    const sb = String(expected);
    return sa === sb ? 0 : sa < sb ? -1 : 1;
  }
  return a === b ? 0 : a < b ? -1 : 1;
}

function evaluateCondition(condition: VisibilityCondition, values: Record<string, unknown>): boolean {
  const actual = values[condition.field];
  const expected = condition.value;
  const present = actual !== undefined && actual !== null;

  switch (condition.op) {
    case 'eq':
      return sameValue(actual, expected);
    case 'neq':
      return !sameValue(actual, expected);
    case 'in':
      return Array.isArray(expected) && expected.some((candidate) => sameValue(actual, candidate));
    case 'nin':
      return !(Array.isArray(expected) && expected.some((candidate) => sameValue(actual, candidate)));
    case 'contains':
      if (Array.isArray(actual)) return actual.some((item) => sameValue(item, expected));
      if (typeof actual === 'string') return actual.includes(String(expected));
      return false;
    case 'gt':
      return present && compare(actual, expected) > 0;
    case 'gte':
      return present && compare(actual, expected) >= 0;
    case 'lt':
      return present && compare(actual, expected) < 0;
    case 'lte':
      return present && compare(actual, expected) <= 0;
    case 'truthy':
      return toBoolean(actual);
    case 'falsy':
      return !toBoolean(actual);
    default:
      return true;
  }
}

export function evaluateNode(node: VisibilityNode, values: Record<string, unknown>): boolean {
  if (isCondition(node)) return evaluateCondition(node, values);

  const { all, any, not } = node;
  if (all && all.length > 0 && !all.every((child) => evaluateNode(child, values))) return false;
  if (any && any.length > 0 && !any.some((child) => evaluateNode(child, values))) return false;
  if (not && evaluateNode(not, values)) return false;
  return true;
}

export function isVisible(
  rule: VisibilityRule | null | undefined,
  values: Record<string, unknown>,
): boolean {
  if (!rule) return true;
  return evaluateNode(rule, values);
}

/**
 * Ordered forward pass so hiding cascades: a field whose controlling field is
 * itself hidden also disappears.
 */
export function visibleFields(
  fields: FieldDefinition[],
  values: Record<string, unknown>,
): FieldDefinition[] {
  const effective = { ...values };
  const visible: FieldDefinition[] = [];

  for (const field of fields) {
    if (isVisible(field.visibilityRule, effective)) {
      visible.push(field);
    } else {
      delete effective[field.key];
    }
  }

  return visible;
}
