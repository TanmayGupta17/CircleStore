import { ConflictError, NotFoundError, SchemaConfigError, ValidationError } from '../core/errors';
import { typeUsesOptions } from '../core/field-types/registry';
import type { FieldConfigDraft } from '../core/field-types/strategy';
import { validateFieldDraft } from '../core/schema/config-validator';
import type { ValidationConfig } from '../core/types';
import type {
  FieldInput,
  FieldRecord,
  FieldUpdateInput,
  IFieldRepository,
} from '../repositories/interfaces';

const KEY_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;

export interface FieldImpact {
  /** Categories currently using this field. */
  attachments: number;
  /** Listings that already stored a value under this key. */
  listingsWithValue: number;
}

/**
 * Manages the GLOBAL field library.
 *
 * The library is global on purpose: "RAM" is one definition shared by Mobile
 * Phone and Laptop. That is what makes cross-category answer carry-over
 * possible in the sell flow, and it means a field is edited in one place.
 */
export class FieldService {
  constructor(private readonly fields: IFieldRepository) {}

  async list(options: { includeInactive?: boolean; search?: string } = {}): Promise<FieldRecord[]> {
    return this.fields.findAll(options);
  }

  async getById(id: string): Promise<FieldRecord> {
    const field = await this.fields.findById(id);
    if (!field) throw new NotFoundError('Field', id);
    return field;
  }

  async create(input: FieldInput): Promise<FieldRecord> {
    if (!KEY_PATTERN.test(input.key)) {
      throw new ValidationError({
        key: 'Key must be lowercase, start with a letter, and contain only letters, numbers and underscores.',
      });
    }

    const existing = await this.fields.findByKey(input.key);
    if (existing) {
      throw new ConflictError(`A field with key "${input.key}" already exists.`);
    }

    this.assertDraftIsValid({
      type: input.type,
      key: input.key,
      label: input.label,
      validation: (input.validation ?? {}) as ValidationConfig,
      options: input.options ?? [],
      defaultValue: input.defaultValue ?? null,
    });

    return this.fields.create({
      ...input,
      options: typeUsesOptions(input.type) ? (input.options ?? []) : [],
    });
  }

  /**
   * Updates a field's presentation and validation.
   *
   * `key` and `type` are absent from `FieldUpdateInput` by design — the type
   * system makes them unchangeable rather than relying on a runtime guard:
   *   - changing `key` would orphan every stored value under the old key
   *   - changing `type` would invalidate stored values (89 as a NUMBER is not
   *     meaningfully a DATE)
   * The intended path is to deactivate the field and create a replacement.
   */
  async update(id: string, input: FieldUpdateInput): Promise<FieldRecord> {
    const field = await this.getById(id);

    this.assertDraftIsValid({
      type: field.type,
      key: field.key,
      label: input.label ?? field.label,
      validation: (input.validation ?? (field.validation as ValidationConfig) ?? {}) as ValidationConfig,
      options: input.options ?? field.options.filter((option) => option.isActive),
      defaultValue: input.defaultValue !== undefined ? input.defaultValue : field.defaultValue,
    });

    return this.fields.update(id, {
      ...input,
      ...(input.options && !typeUsesOptions(field.type) ? { options: [] } : {}),
    });
  }

  /**
   * Soft delete. Never a hard delete: existing listings resolve their stored
   * values through `Listing.schemaSnapshot`, but the field must remain
   * resurrectable and must not break admin screens that reference it.
   */
  async setActive(id: string, isActive: boolean): Promise<FieldRecord> {
    await this.getById(id);
    return this.fields.setActive(id, isActive);
  }

  /**
   * What breaks if this field changes. Surfaced in the admin UI before a
   * destructive action so the operator is never guessing.
   */
  async getImpact(id: string): Promise<FieldImpact> {
    const field = await this.getById(id);
    const [attachments, listingsWithValue] = await Promise.all([
      this.fields.countAttachments(field.id),
      this.fields.countListingsWithValue(field.key),
    ]);
    return { attachments, listingsWithValue };
  }

  private assertDraftIsValid(draft: FieldConfigDraft): void {
    const issues = validateFieldDraft(draft);
    if (issues.length > 0) throw new SchemaConfigError(issues);
  }
}
