import { Router } from 'express';
import type { Container } from '../container';
import { asyncHandler } from '../middlewares/async-handler';

/**
 * Route table.
 *
 * Public routes serve the storefront and the sell flow. Admin routes manage the
 * category/field configuration that those public routes consume.
 *
 * NOTE: `/admin` is unauthenticated in this build — see README "Out of scope".
 * In production this router would sit behind an authorisation middleware; it is
 * mounted separately precisely so that is a one-line change.
 */
export function buildRouter(container: Container): Router {
  const router = Router();
  const { categoryController, fieldController, listingController, uploadController } = container;

  // --- Public ---------------------------------------------------------------

  router.get('/categories', asyncHandler(categoryController.list));
  router.get('/categories/:slug/form-schema', asyncHandler(categoryController.getFormSchema));
  router.get('/field-types', asyncHandler(categoryController.fieldTypes));

  // Uploads: the API only mints credentials — file bytes go straight from the
  // browser to the storage provider and never pass through this process.
  router.get('/uploads/capabilities', asyncHandler(uploadController.capabilities));
  router.post('/uploads/signature', asyncHandler(uploadController.createSignature));

  router.get('/listings', asyncHandler(listingController.list));
  router.post('/listings', asyncHandler(listingController.create));
  router.get('/listings/:slug', asyncHandler(listingController.getBySlug));

  // --- Admin ----------------------------------------------------------------

  const admin = Router();

  admin.get('/categories', asyncHandler(categoryController.list));
  admin.post('/categories', asyncHandler(categoryController.create));
  admin.patch('/categories/:id', asyncHandler(categoryController.update));
  admin.patch('/categories/:id/active', asyncHandler(categoryController.setActive));

  admin.get('/categories/:id/fields', asyncHandler(categoryController.listAttachments));
  admin.post('/categories/:id/fields', asyncHandler(categoryController.attachField));
  admin.patch('/categories/:id/fields/order', asyncHandler(categoryController.reorderFields));
  admin.patch('/field-attachments/:attachmentId', asyncHandler(categoryController.updateAttachment));
  admin.delete('/field-attachments/:attachmentId', asyncHandler(categoryController.detachField));

  admin.get('/fields', asyncHandler(fieldController.list));
  admin.post('/fields', asyncHandler(fieldController.create));
  admin.get('/fields/:id', asyncHandler(fieldController.getById));
  admin.get('/fields/:id/impact', asyncHandler(fieldController.getImpact));
  admin.patch('/fields/:id', asyncHandler(fieldController.update));
  admin.patch('/fields/:id/active', asyncHandler(fieldController.setActive));

  router.use('/admin', admin);

  return router;
}
