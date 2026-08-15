import type {
  AttributeValues,
  FieldDefinition,
  VisibilityCondition,
  VisibilityNode,
  VisibilityRule,
} from '../types';

/**
 * Conditional-field evaluation.
 *
 * This module is shared by the validator (to decide what is required and what
 * must be stripped) and mirrored by the frontend (to decide what to render).
 * Keeping it a pure function of (rule, values) is what stops the two from
 * drifting apart.
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

/**
 * Loose equality across transport shapes. A rule authored as `"yes"` must match
 * a stored boolean `true`, because the admin writes rules in the UI's language
 * while the strategy stores the canonical type.
 */
function sameValue(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (actual === undefined || actual === null) return false;
  if (typeof actual === 'boolean' || typeof expected === 'boolean') {
    return toBoolean(actual) === toBoolean(expected);
  }
  return String(actual) === String(expected);
}

function compareNumeric(actual: unknown, expected: unknown): number | null {
  const a = typeof actual === 'number' ? actual : Number(String(actual));
  const b = typeof expected === 'number' ? expected : Number(String(expected));
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    // Fall back to lexicographic comparison so ISO dates still order correctly.
    const sa = String(actual);
    const sb = String(expected);
    return sa === sb ? 0 : sa < sb ? -1 : 1;
  }
  return a === b ? 0 : a < b ? -1 : 1;
}

function evaluateCondition(condition: VisibilityCondition, values: AttributeValues): boolean {
  const actual = values[condition.field];
  const expected = condition.value;

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
      return actual !== undefined && actual !== null && (compareNumeric(actual, expected) ?? 0) > 0;
    case 'gte':
      return actual !== undefined && actual !== null && (compareNumeric(actual, expected) ?? 0) >= 0;
    case 'lt':
      return actual !== undefined && actual !== null && (compareNumeric(actual, expected) ?? 0) < 0;
    case 'lte':
      return actual !== undefined && actual !== null && (compareNumeric(actual, expected) ?? 0) <= 0;
    case 'truthy':
      return toBoolean(actual);
    case 'falsy':
      return !toBoolean(actual);
    default:
      // Unknown operator: fail open so a bad rule never hides a field the
      // seller needs in order to complete a listing.
      return true;
  }
}

export function evaluateNode(node: VisibilityNode, values: AttributeValues): boolean {
  if (isCondition(node)) return evaluateCondition(node, values);

  const { all, any, not } = node;
  if (all && all.length > 0 && !all.every((child) => evaluateNode(child, values))) return false;
  if (any && any.length > 0 && !any.some((child) => evaluateNode(child, values))) return false;
  if (not && evaluateNode(not, values)) return false;
  return true;
}

/** A field with no rule is always visible. */
export function isVisible(rule: VisibilityRule | null | undefined, values: AttributeValues): boolean {
  if (!rule) return true;
  return evaluateNode(rule, values);
}

/** Every field key a rule reads. Used for cycle and dependency checks. */
export function ruleDependencies(rule: VisibilityRule | null | undefined): string[] {
  if (!rule) return [];
  const keys = new Set<string>();

  const walk = (node: VisibilityNode): void => {
    if (isCondition(node)) {
      keys.add(node.field);
      return;
    }
    node.all?.forEach(walk);
    node.any?.forEach(walk);
    if (node.not) walk(node.not);
  };

  walk(rule);
  return Array.from(keys);
}

export interface VisibilityResolution {
  visible: FieldDefinition[];
  hiddenKeys: string[];
  /** Input values with every hidden field's value removed. */
  effectiveValues: AttributeValues;
}

/**
 * Resolves visibility across a whole form in one forward pass.
 *
 * The pass is ordered, and each field is evaluated against values from which
 * earlier hidden fields have ALREADY been stripped. That makes hiding cascade
 * correctly: if "Under warranty" is itself hidden, anything depending on it
 * hides too, instead of reading a stale value.
 *
 * Ordering is safe because `validateCategoryConfig` rejects any rule that
 * points at a field appearing later in the form.
 */
export function resolveVisibility(
  fields: FieldDefinition[],
  values: AttributeValues,
): VisibilityResolution {
  const effectiveValues: AttributeValues = { ...values };
  const visible: FieldDefinition[] = [];
  const hiddenKeys: string[] = [];

  for (const field of fields) {
    if (isVisible(field.visibilityRule, effectiveValues)) {
      visible.push(field);
    } else {
      hiddenKeys.push(field.key);
      // Strip, so an answer given before the seller changed their mind is
      // never persisted. This is the single most common bug in conditional
      // forms: "Under warranty: No" shipping with a stale expiry date.
      delete effectiveValues[field.key];
    }
  }

  return { visible, hiddenKeys, effectiveValues };
}
