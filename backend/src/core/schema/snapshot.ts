import type { AttributeValues, FieldDefinition, FieldType } from '../types';
import { getStrategy } from '../field-types/registry';

/**
 * A field definition frozen at the moment a listing was submitted.
 *
 * Only what is needed to RENDER the stored value — not validation rules, which
 * would be meaningless to re-apply to historical data.
 */
export interface SnapshotEntry {
  key: string;
  label: string;
  type: FieldType;
  unit: string | null;
  section: string;
  sortOrder: number;
  showInCard: boolean;
  /** Present for choice types so stored values can be shown as their labels. */
  options?: Array<{ value: string; label: string }>;
}

/**
 * Builds the snapshot persisted alongside a listing.
 *
 * Why this exists: field definitions are mutable by admins, but a listing is a
 * historical record. Without a snapshot, deactivating "Battery Health" would
 * silently erase that row from every existing PDP, and renaming a select option
 * would retroactively rewrite what a seller said. The PDP therefore renders from
 * the snapshot and never reads live definitions.
 *
 * Only fields that were visible AND answered are captured — there is no value in
 * freezing a definition for a question the seller never saw.
 */
export function buildSnapshot(
  visibleFields: FieldDefinition[],
  values: AttributeValues,
): SnapshotEntry[] {
  return visibleFields
    .filter((field) => !getStrategy(field.type).isEmpty(values[field.key]))
    .map((field) => {
      const entry: SnapshotEntry = {
        key: field.key,
        label: field.label,
        type: field.type,
        unit: field.unit,
        section: field.section,
        sortOrder: field.sortOrder,
        showInCard: field.showInCard,
      };

      if (getStrategy(field.type).usesOptions) {
        entry.options = field.options.map(({ value, label }) => ({ value, label }));
      }

      return entry;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

/** Defensive read of the JSON column, which is `unknown` at the boundary. */
export function parseSnapshot(raw: unknown): SnapshotEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is SnapshotEntry =>
      !!entry && typeof entry === 'object' && typeof (entry as SnapshotEntry).key === 'string',
  );
}
