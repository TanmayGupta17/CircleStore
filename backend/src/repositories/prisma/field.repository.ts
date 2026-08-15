import type { PrismaClient } from '@prisma/client';
import type { FieldType } from '../../core/types';
import type {
  FieldInput,
  FieldRecord,
  FieldUpdateInput,
  IFieldRepository,
} from '../interfaces';

const FIELD_SELECT = {
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
    select: { id: true, value: true, label: true, sortOrder: true, isActive: true },
    orderBy: { sortOrder: 'asc' },
  },
  _count: { select: { categoryFields: true } },
} as const;

type FieldRow = {
  _count: { categoryFields: number };
  type: string;
} & Omit<FieldRecord, 'type' | 'usageCount'>;

function toRecord(row: FieldRow): FieldRecord {
  const { _count, ...field } = row;
  return { ...field, type: field.type as FieldType, usageCount: _count.categoryFields };
}

export class PrismaFieldRepository implements IFieldRepository {
  constructor(private readonly db: PrismaClient) {}

  async findAll(options: { includeInactive?: boolean; search?: string } = {}): Promise<FieldRecord[]> {
    const rows = await this.db.field.findMany({
      where: {
        ...(options.includeInactive ? {} : { isActive: true }),
        ...(options.search
          ? {
              OR: [
                { label: { contains: options.search, mode: 'insensitive' as const } },
                { key: { contains: options.search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: FIELD_SELECT,
      orderBy: [{ label: 'asc' }],
    });

    return rows.map(toRecord);
  }

  async findById(id: string): Promise<FieldRecord | null> {
    const row = await this.db.field.findUnique({ where: { id }, select: FIELD_SELECT });
    return row ? toRecord(row) : null;
  }

  async findByKey(key: string): Promise<FieldRecord | null> {
    const row = await this.db.field.findUnique({ where: { key }, select: FIELD_SELECT });
    return row ? toRecord(row) : null;
  }

  async create(input: FieldInput): Promise<FieldRecord> {
    const row = await this.db.field.create({
      data: {
        key: input.key,
        label: input.label,
        type: input.type,
        helpText: input.helpText ?? null,
        unit: input.unit ?? null,
        placeholder: input.placeholder ?? null,
        defaultValue: input.defaultValue ?? null,
        validation: (input.validation ?? {}) as object,
        options: {
          create: (input.options ?? []).map((option) => ({
            value: option.value,
            label: option.label,
            sortOrder: option.sortOrder,
          })),
        },
      },
      select: FIELD_SELECT,
    });

    return toRecord(row);
  }

  /**
   * Options are replaced wholesale inside a transaction.
   *
   * Options still referenced by existing listings are deactivated rather than
   * deleted, so a historical listing can still resolve its stored value to a
   * label. Genuinely unused ones are removed to keep the admin list clean.
   */
  async update(id: string, input: FieldUpdateInput): Promise<FieldRecord> {
    const row = await this.db.$transaction(async (tx) => {
      if (input.options) {
        const incoming = new Set(input.options.map((option) => option.value));
        const existing = await tx.fieldOption.findMany({ where: { fieldId: id } });

        const removed = existing.filter((option) => !incoming.has(option.value));
        if (removed.length > 0) {
          await tx.fieldOption.updateMany({
            where: { id: { in: removed.map((option) => option.id) } },
            data: { isActive: false },
          });
        }

        for (const option of input.options) {
          await tx.fieldOption.upsert({
            where: { fieldId_value: { fieldId: id, value: option.value } },
            create: {
              fieldId: id,
              value: option.value,
              label: option.label,
              sortOrder: option.sortOrder,
            },
            update: { label: option.label, sortOrder: option.sortOrder, isActive: true },
          });
        }
      }

      return tx.field.update({
        where: { id },
        data: {
          ...(input.label !== undefined && { label: input.label }),
          ...(input.helpText !== undefined && { helpText: input.helpText }),
          ...(input.unit !== undefined && { unit: input.unit }),
          ...(input.placeholder !== undefined && { placeholder: input.placeholder }),
          ...(input.defaultValue !== undefined && { defaultValue: input.defaultValue }),
          ...(input.validation !== undefined && { validation: input.validation as object }),
        },
        select: FIELD_SELECT,
      });
    });

    return toRecord(row);
  }

  async setActive(id: string, isActive: boolean): Promise<FieldRecord> {
    const row = await this.db.field.update({
      where: { id },
      data: { isActive },
      select: FIELD_SELECT,
    });
    return toRecord(row);
  }

  /**
   * Counts listings holding a value under this key.
   *
   * Uses `attributes -> key IS NOT NULL` rather than the `?` containment
   * operator, which collides with driver placeholder syntax.
   */
  async countListingsWithValue(key: string): Promise<number> {
    const rows = await this.db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM listings WHERE attributes -> ${key} IS NOT NULL
    `;
    return Number(rows[0]?.count ?? 0);
  }

  async countAttachments(fieldId: string): Promise<number> {
    return this.db.categoryField.count({ where: { fieldId } });
  }
}
