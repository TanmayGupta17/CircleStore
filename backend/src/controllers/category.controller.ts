import type { Request, Response } from 'express';
import { listFieldTypes } from '../core/field-types/registry';
import type { CategoryService } from '../services/category.service';
import {
  attachFieldSchema,
  createCategorySchema,
  reorderSchema,
  setActiveSchema,
  updateAttachmentSchema,
  updateCategorySchema,
} from '../validators/admin.validators';

export class CategoryController {
  constructor(private readonly categories: CategoryService) {}

  // --- Public -------------------------------------------------------------

  list = async (req: Request, res: Response): Promise<void> => {
    const includeInactive = req.query.includeInactive === 'true';
    res.json({ items: await this.categories.list({ includeInactive }) });
  };

  /**
   * The contract that drives the entire seller experience. Everything the
   * client needs to render, validate and preview a category's form.
   */
  getFormSchema = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.categories.getFormSchema(String(req.params.slug)));
  };

  /** Catalogue of supported input types, read straight from the registry. */
  fieldTypes = async (_req: Request, res: Response): Promise<void> => {
    res.json({ items: listFieldTypes() });
  };

  // --- Admin --------------------------------------------------------------

  create = async (req: Request, res: Response): Promise<void> => {
    const input = createCategorySchema.parse(req.body);
    res.status(201).json(await this.categories.create(input));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const input = updateCategorySchema.parse(req.body);
    res.json(await this.categories.update(String(req.params.id), input));
  };

  setActive = async (req: Request, res: Response): Promise<void> => {
    const { isActive } = setActiveSchema.parse(req.body);
    res.json(await this.categories.setActive(String(req.params.id), isActive));
  };

  /** Own attachments with their row ids, for the category builder screen. */
  listAttachments = async (req: Request, res: Response): Promise<void> => {
    res.json({ items: await this.categories.getAttachments(String(req.params.id)) });
  };

  attachField = async (req: Request, res: Response): Promise<void> => {
    const input = attachFieldSchema.parse(req.body);
    const attachment = await this.categories.attachField({
      ...input,
      categoryId: String(req.params.id),
    });
    res.status(201).json(attachment);
  };

  updateAttachment = async (req: Request, res: Response): Promise<void> => {
    const input = updateAttachmentSchema.parse(req.body);
    res.json(await this.categories.updateAttachment(String(req.params.attachmentId), input));
  };

  detachField = async (req: Request, res: Response): Promise<void> => {
    await this.categories.detachField(String(req.params.attachmentId));
    res.status(204).send();
  };

  reorderFields = async (req: Request, res: Response): Promise<void> => {
    const { orderedIds } = reorderSchema.parse(req.body);
    await this.categories.reorderFields(String(req.params.id), orderedIds);
    res.status(204).send();
  };
}
