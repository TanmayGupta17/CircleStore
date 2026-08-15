import { z } from 'zod';
import {
  FIELD_TYPES,
  VISIBILITY_OPERATORS,
  type VisibilityNode,
  type VisibilityRule,
} from '../core/types';

/** Request schemas for the admin surface. */

// ---------------------------------------------------------------------------
// Conditional rules
// ---------------------------------------------------------------------------

const conditionSchema = z.object({
  field: z.string().trim().min(1),
  op: z.enum(VISIBILITY_OPERATORS),
  value: z.unknown().optional(),
});

/**
 * Rules nest arbitrarily, so the schema is recursive. `z.lazy` is required
 * because the type refers to itself before it is defined, and the explicit
 * annotation keeps the inferred output tied to the domain type instead of
 * degrading to `unknown` at the controller boundary.
 */
const ruleNodeSchema: z.ZodType<VisibilityNode> = z.lazy(() =>
  z.union([
    conditionSchema,
    z.object({
      all: z.array(ruleNodeSchema).optional(),
      any: z.array(ruleNodeSchema).optional(),
      not: ruleNodeSchema.optional(),
    }),
  ]),
) as z.ZodType<VisibilityNode>;

export const visibilityRuleSchema: z.ZodType<VisibilityRule | null> = z
  .object({
    all: z.array(ruleNodeSchema).optional(),
    any: z.array(ruleNodeSchema).optional(),
    not: ruleNodeSchema.optional(),
  })
  .nullable();

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(60),
  slug: z.string().trim().max(60).optional(),
  description: z.string().trim().max(300).nullish(),
  icon: z.string().trim().max(16).nullish(),
  parentId: z.string().uuid().nullish(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const setActiveSchema = z.object({ isActive: z.boolean() });

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

const validationSchema = z
  .object({
    min: z.union([z.number(), z.string()]).optional(),
    max: z.union([z.number(), z.string()]).optional(),
    step: z.number().positive().optional(),
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(1).optional(),
    pattern: z.string().max(200).optional(),
    patternMessage: z.string().max(200).optional(),
    minSelected: z.number().int().min(0).optional(),
    maxSelected: z.number().int().min(1).optional(),
  })
  .strict();

const optionSchema = z.object({
  value: z.string().trim().min(1, 'Option value is required.').max(80),
  label: z.string().trim().min(1, 'Option label is required.').max(120),
  sortOrder: z.number().int().min(0).default(0),
});

export const createFieldSchema = z.object({
  key: z.string().trim().min(2).max(50),
  label: z.string().trim().min(1, 'Label is required.').max(80),
  type: z.enum(FIELD_TYPES),
  helpText: z.string().trim().max(300).nullish(),
  unit: z.string().trim().max(16).nullish(),
  placeholder: z.string().trim().max(120).nullish(),
  defaultValue: z.string().trim().max(200).nullish(),
  validation: validationSchema.default({}),
  options: z.array(optionSchema).max(60).default([]),
});

/** `key` and `type` are intentionally not updatable — see FieldService.update. */
export const updateFieldSchema = createFieldSchema.omit({ key: true, type: true }).partial();

// ---------------------------------------------------------------------------
// Category <-> field attachments
// ---------------------------------------------------------------------------

export const attachFieldSchema = z.object({
  fieldId: z.string().uuid('Select a field to attach.'),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().min(0).optional(),
  section: z.string().trim().min(1).max(60).default('Details'),
  showInCard: z.boolean().default(false),
  visibilityRule: visibilityRuleSchema.optional(),
  overrides: validationSchema.nullish(),
});

export const updateAttachmentSchema = z.object({
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  section: z.string().trim().min(1).max(60).optional(),
  showInCard: z.boolean().optional(),
  visibilityRule: visibilityRuleSchema.optional(),
  overrides: validationSchema.nullish(),
});

export const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1, 'Provide the new field order.'),
});
