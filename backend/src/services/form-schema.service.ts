import { NotFoundError } from '../core/errors';
import { resolveFormSchema } from '../core/schema/resolver';
import type { FormSchema } from '../core/types';
import type { ICategoryFieldRepository, ICategoryRepository } from '../repositories/interfaces';

/**
 * Produces the FormSchema — the single contract that drives the seller form,
 * server-side validation, the admin preview and the PDP.
 *
 * Everything category-aware in the product funnels through here, which is why
 * there is exactly one implementation of "what fields does this category have".
 */
export class FormSchemaService {
  constructor(
    private readonly categories: ICategoryRepository,
    private readonly attachments: ICategoryFieldRepository,
  ) {}

  async getBySlug(slug: string): Promise<FormSchema> {
    const category = await this.categories.findBySlug(slug);
    if (!category) throw new NotFoundError('Category', slug);
    return this.build(category.id);
  }

  async getById(categoryId: string): Promise<FormSchema> {
    const category = await this.categories.findById(categoryId);
    if (!category) throw new NotFoundError('Category', categoryId);
    return this.build(categoryId);
  }

  /**
   * Three queries regardless of how many fields the category has: the category,
   * its ancestors, and one batched fetch of every attachment in the chain.
   */
  private async build(categoryId: string): Promise<FormSchema> {
    const category = await this.categories.findById(categoryId);
    if (!category) throw new NotFoundError('Category', categoryId);

    const ancestors = await this.categories.findAncestors(categoryId);
    const chainIds = [...ancestors.map((ancestor) => ancestor.id), category.id];
    const attachments = await this.attachments.findByCategoryIds(chainIds);

    return resolveFormSchema({ category, ancestors, attachments });
  }
}
