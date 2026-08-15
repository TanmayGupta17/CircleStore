import type { Request, Response } from 'express';
import type { FieldService } from '../services/field.service';
import { createFieldSchema, setActiveSchema, updateFieldSchema } from '../validators/admin.validators';

export class FieldController {
  constructor(private readonly fields: FieldService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const items = await this.fields.list({
      includeInactive: req.query.includeInactive === 'true',
      search: typeof req.query.q === 'string' ? req.query.q : undefined,
    });
    res.json({ items });
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.fields.getById(String(req.params.id)));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const input = createFieldSchema.parse(req.body);
    res.status(201).json(await this.fields.create(input));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const input = updateFieldSchema.parse(req.body);
    res.json(await this.fields.update(String(req.params.id), input));
  };

  setActive = async (req: Request, res: Response): Promise<void> => {
    const { isActive } = setActiveSchema.parse(req.body);
    res.json(await this.fields.setActive(String(req.params.id), isActive));
  };

  /**
   * Blast radius of changing this field, shown in the admin UI before any
   * destructive action so the operator is never guessing.
   */
  getImpact = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.fields.getImpact(String(req.params.id)));
  };
}
