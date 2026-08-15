import type { PrismaClient } from '@prisma/client';
import type { RawCategoryFieldRow } from '../../core/schema/resolver';
import type { FieldType } from '../../core/types';
import type {
  AttachFieldInput,
  CategoryFieldRecord,
  ICategoryFieldRepository,
  UpdateAttachmentInput,
} from '../interfaces';

const ATTACHMENT_SELECT = {
  id: true,
  categoryId: true,
  fieldId: true,
  isRequired: true,
  sortOrder: true,
  section: true,
  showInCard: true,
  visibilityRule: true,
  overrides: true,
} as const;

export class PrismaCategoryFieldRepository implements ICategoryFieldRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Loads every attachment for a category chain in ONE query with its fields and
   * options eagerly included. Resolving a form schema must not fan out into a
   * query per field — that N+1 is the classic performance trap in this design.
   */
  async findByCategoryIds(categoryIds: string[]): Promise<RawCategoryFieldRow[]> {
    if (categoryIds.length === 0) return [];

    const rows = await this.db.categoryField.findMany({
      where: { categoryId: { in: categoryIds } },
      select: {
        id: true,
        categoryId: true,
        isRequired: true,
        sortOrder: true,
        section: true,
        showInCard: true,
        visibilityRule: true,
        overrides: true,
        field: {
          select: {
            id: true,
            key: true,
            label: true,
            type: true,
            helpText: true,
            unit: true,
            placeholder: true,
            defaultValue: true,
            validation: true,
            isActive: true,
            options: {
              select: { value: true, label: true, sortOrder: true, isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }],
    });

    return rows.map((row) => ({
      ...row,
      field: { ...row.field, type: row.field.type as FieldType },
    }));
  }

  async findById(id: string): Promise<CategoryFieldRecord | null> {
    return this.db.categoryField.findUnique({ where: { id }, select: ATTACHMENT_SELECT });
  }

  async findOne(categoryId: string, fieldId: string): Promise<CategoryFieldRecord | null> {
    return this.db.categoryField.findUnique({
      where: { categoryId_fieldId: { categoryId, fieldId } },
      select: ATTACHMENT_SELECT,
    });
  }

  async attach(input: AttachFieldInput): Promise<CategoryFieldRecord> {
    return this.db.categoryField.create({
      data: {
        categoryId: input.categoryId,
        fieldId: input.fieldId,
        isRequired: input.isRequired ?? false,
        sortOrder: input.sortOrder ?? 0,
        section: input.section ?? 'Details',
        showInCard: input.showInCard ?? false,
        visibilityRule: (input.visibilityRule ?? undefined) as object | undefined,
        overrides: (input.overrides ?? undefined) as object | undefined,
      },
      select: ATTACHMENT_SELECT,
    });
  }

  async update(id: string, input: UpdateAttachmentInput): Promise<CategoryFieldRecord> {
    return this.db.categoryField.update({
      where: { id },
      data: {
        ...(input.isRequired !== undefined && { isRequired: input.isRequired }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        ...(input.section !== undefined && { section: input.section }),
        ...(input.showInCard !== undefined && { showInCard: input.showInCard }),
        // `null` clears the rule; `undefined` leaves it untouched.
        ...(input.visibilityRule !== undefined && {
          visibilityRule: (input.visibilityRule ?? undefined) as object | undefined,
        }),
        ...(input.overrides !== undefined && {
          overrides: (input.overrides ?? undefined) as object | undefined,
        }),
      },
      select: ATTACHMENT_SELECT,
    });
  }

  async detach(id: string): Promise<void> {
    await this.db.categoryField.delete({ where: { id } });
  }

  /** All-or-nothing so a failed reorder cannot leave the form half-shuffled. */
  async reorder(categoryId: string, orderedIds: string[]): Promise<void> {
    await this.db.$transaction(
      orderedIds.map((id, index) =>
        this.db.categoryField.updateMany({
          where: { id, categoryId },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  async nextSortOrder(categoryId: string): Promise<number> {
    const last = await this.db.categoryField.findFirst({
      where: { categoryId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (last?.sortOrder ?? -1) + 1;
  }
}
