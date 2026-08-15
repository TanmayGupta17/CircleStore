import { ConflictError, NotFoundError, SchemaConfigError, ValidationError } from '../core/errors';
import { validateCategoryConfig } from '../core/schema/config-validator';
import type { RawCategoryFieldRow } from '../core/schema/resolver';
import type { FieldDefinition, FormSchema, ValidationConfig, VisibilityRule } from '../core/types';
import type {
  AttachFieldInput,
  CategoryFieldRecord,
  CategoryInput,
  CategoryRecord,
  CategoryWithCounts,
  ICategoryFieldRepository,
  ICategoryRepository,
  IFieldRepository,
  UpdateAttachmentInput,
} from '../repositories/interfaces';
import { slugify } from '../utils/slug';
import type { FormSchemaService } from './form-schema.service';

/** Admins may supply a slug or let one be generated from the name. */
export interface CreateCategoryInput extends Omit<CategoryInput, 'slug'> {
  slug?: string;
}

/**
 * Category management, and — more importantly — the wiring of fields to
 * categories.
 *
 * Every mutation that changes a category's form is DRY-RUN FIRST: the
 * prospective field list is assembled in memory and run through
 * `validateCategoryConfig`. A configuration with a circular rule, a forward
 * reference or a dangling dependency is rejected before it can reach a seller.
 */
export class CategoryService {
  constructor(
    private readonly categories: ICategoryRepository,
    private readonly attachments: ICategoryFieldRepository,
    private readonly fields: IFieldRepository,
    private readonly formSchemas: FormSchemaService,
  ) {}

  async list(options: { includeInactive?: boolean } = {}): Promise<CategoryWithCounts[]> {
    return this.categories.findAll(options);
  }

  async getById(id: string): Promise<CategoryRecord> {
    const category = await this.categories.findById(id);
    if (!category) throw new NotFoundError('Category', id);
    return category;
  }

  async getFormSchema(slug: string): Promise<FormSchema> {
    return this.formSchemas.getBySlug(slug);
  }

  /**
   * Attachments owned directly by this category (not inherited ones).
   *
   * The admin UI needs the attachment row ids in order to edit, reorder and
   * detach — data the public form-schema deliberately does not carry.
   */
  async getAttachments(categoryId: string): Promise<RawCategoryFieldRow[]> {
    await this.getById(categoryId);
    const rows = await this.attachments.findByCategoryIds([categoryId]);
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /** `slug` is optional: it is derived from the name when the admin omits it. */
  async create(input: CreateCategoryInput): Promise<CategoryRecord> {
    const slug = slugify(input.slug || input.name);
    if (!slug) throw new ValidationError({ name: 'Category name must contain letters or numbers.' });

    if (await this.categories.slugExists(slug)) {
      throw new ConflictError(`A category with slug "${slug}" already exists.`);
    }

    if (input.parentId) await this.getById(input.parentId);

    return this.categories.create({ ...input, slug });
  }

  async update(id: string, input: Partial<CategoryInput>): Promise<CategoryRecord> {
    await this.getById(id);

    if (input.slug) {
      const slug = slugify(input.slug);
      if (await this.categories.slugExists(slug, id)) {
        throw new ConflictError(`A category with slug "${slug}" already exists.`);
      }
      input = { ...input, slug };
    }

    if (input.parentId) {
      if (input.parentId === id) {
        throw new ValidationError({ parentId: 'A category cannot be its own parent.' });
      }
      // Re-parenting under a descendant would create an unresolvable cycle.
      const descendants = await this.categories.findDescendantIds(id);
      if (descendants.includes(input.parentId)) {
        throw new ValidationError({ parentId: 'A category cannot be moved under its own descendant.' });
      }
      await this.getById(input.parentId);
    }

    return this.categories.update(id, input);
  }

  /** Soft delete — listings reference categories, so rows are never removed. */
  async setActive(id: string, isActive: boolean): Promise<CategoryRecord> {
    await this.getById(id);
    return this.categories.setActive(id, isActive);
  }

  // -------------------------------------------------------------------------
  // Field configuration
  // -------------------------------------------------------------------------

  async attachField(input: AttachFieldInput): Promise<CategoryFieldRecord> {
    await this.getById(input.categoryId);

    const field = await this.fields.findById(input.fieldId);
    if (!field) throw new NotFoundError('Field', input.fieldId);

    const existing = await this.attachments.findOne(input.categoryId, input.fieldId);
    if (existing) {
      throw new ConflictError(`"${field.label}" is already attached to this category.`);
    }

    const sortOrder = input.sortOrder ?? (await this.attachments.nextSortOrder(input.categoryId));
    const current = await this.formSchemas.getById(input.categoryId);

    const prospective: FieldDefinition = {
      fieldId: field.id,
      key: field.key,
      label: field.label,
      type: field.type,
      helpText: field.helpText,
      unit: field.unit,
      placeholder: field.placeholder,
      defaultValue: field.defaultValue,
      options: field.options
        .filter((option) => option.isActive)
        .map(({ value, label, sortOrder: order }) => ({ value, label, sortOrder: order })),
      validation: {
        ...((field.validation as ValidationConfig) ?? {}),
        ...((input.overrides as ValidationConfig) ?? {}),
      },
      isRequired: input.isRequired ?? false,
      section: input.section ?? 'Details',
      sortOrder,
      showInCard: input.showInCard ?? false,
      visibilityRule: input.visibilityRule ?? null,
      inheritedFrom: null,
    };

    this.assertConfigIsValid(sortFields([...current.fields, prospective]));

    return this.attachments.attach({ ...input, sortOrder });
  }

  async updateAttachment(
    attachmentId: string,
    input: UpdateAttachmentInput,
  ): Promise<CategoryFieldRecord> {
    const attachment = await this.attachments.findById(attachmentId);
    if (!attachment) throw new NotFoundError('Field attachment', attachmentId);

    const current = await this.formSchemas.getById(attachment.categoryId);
    const prospective = current.fields.map((field) =>
      field.fieldId === attachment.fieldId ? applyAttachmentChanges(field, input) : field,
    );

    this.assertConfigIsValid(sortFields(prospective));

    return this.attachments.update(attachmentId, input);
  }

  /**
   * Detaching is a hard delete of the MAPPING only — the field definition and
   * every existing listing's data survive untouched.
   */
  async detachField(attachmentId: string): Promise<void> {
    const attachment = await this.attachments.findById(attachmentId);
    if (!attachment) throw new NotFoundError('Field attachment', attachmentId);

    const current = await this.formSchemas.getById(attachment.categoryId);
    const prospective = current.fields.filter((field) => field.fieldId !== attachment.fieldId);

    // Catches the case where another field's rule depends on this one.
    this.assertConfigIsValid(prospective);

    await this.attachments.detach(attachmentId);
  }

  /**
   * Reordering is validated because it can break conditional rules: moving a
   * controlling field below its dependant creates a forward reference.
   */
  async reorderFields(categoryId: string, orderedAttachmentIds: string[]): Promise<void> {
    await this.getById(categoryId);

    const rows = await Promise.all(
      orderedAttachmentIds.map((id) => this.attachments.findById(id)),
    );

    const positionByFieldId = new Map<string, number>();
    rows.forEach((row, index) => {
      if (!row) throw new NotFoundError('Field attachment', orderedAttachmentIds[index]);
      if (row.categoryId !== categoryId) {
        throw new ValidationError({ order: 'Attachment does not belong to this category.' });
      }
      positionByFieldId.set(row.fieldId, index);
    });

    const current = await this.formSchemas.getById(categoryId);
    const prospective = current.fields.map((field) => ({
      ...field,
      sortOrder: positionByFieldId.get(field.fieldId) ?? field.sortOrder,
    }));

    this.assertConfigIsValid(sortFields(prospective));

    await this.attachments.reorder(categoryId, orderedAttachmentIds);
  }

  private assertConfigIsValid(fields: FieldDefinition[]): void {
    const issues = validateCategoryConfig(fields);
    if (issues.length > 0) throw new SchemaConfigError(issues);
  }
}

function sortFields(fields: FieldDefinition[]): FieldDefinition[] {
  return [...fields].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

function applyAttachmentChanges(
  field: FieldDefinition,
  input: UpdateAttachmentInput,
): FieldDefinition {
  return {
    ...field,
    ...(input.isRequired !== undefined && { isRequired: input.isRequired }),
    ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    ...(input.section !== undefined && { section: input.section }),
    ...(input.showInCard !== undefined && { showInCard: input.showInCard }),
    ...(input.visibilityRule !== undefined && {
      visibilityRule: (input.visibilityRule ?? null) as VisibilityRule | null,
    }),
    ...(input.overrides !== undefined && {
      validation: { ...field.validation, ...((input.overrides as ValidationConfig) ?? {}) },
    }),
  };
}
