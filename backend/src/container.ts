import { env } from './config/env';
import { CategoryController } from './controllers/category.controller';
import { FieldController } from './controllers/field.controller';
import { ListingController } from './controllers/listing.controller';
import { prisma } from './models/prisma';
import { PrismaCategoryFieldRepository } from './repositories/prisma/category-field.repository';
import { PrismaCategoryRepository } from './repositories/prisma/category.repository';
import { PrismaFieldRepository } from './repositories/prisma/field.repository';
import { PrismaListingRepository } from './repositories/prisma/listing.repository';
import { CategoryService } from './services/category.service';
import { FieldService } from './services/field.service';
import { FormSchemaService } from './services/form-schema.service';
import { ListingService } from './services/listing.service';
import { UploadService } from './services/upload.service';
import { CloudinaryProvider } from './storage/cloudinary.provider';
import { UnconfiguredStorageProvider, type StorageProvider } from './storage/storage-provider';
import { UploadController } from './controllers/upload.controller';

/**
 * Composition root.
 *
 * The one place where concrete implementations are chosen and wired together.
 * Every layer below receives its collaborators through its constructor and
 * depends only on interfaces — so swapping Prisma for another store, or
 * injecting fakes in a test, happens here and nowhere else.
 */
export function buildContainer() {
  // Persistence
  const categoryRepository = new PrismaCategoryRepository(prisma);
  const fieldRepository = new PrismaFieldRepository(prisma);
  const categoryFieldRepository = new PrismaCategoryFieldRepository(prisma);
  const listingRepository = new PrismaListingRepository(prisma);

  // External services. Choosing the concrete provider is a composition-root
  // concern; nothing downstream knows which one it got.
  const storageProvider: StorageProvider = env.cloudinary.cloudName
    ? new CloudinaryProvider(env.cloudinary)
    : new UnconfiguredStorageProvider();

  const uploadService = new UploadService(storageProvider, {
    maxBytes: env.uploads.maxBytes,
    allowedMimeTypes: env.uploads.allowedMimeTypes,
    folder: env.cloudinary.folder,
  });

  // Domain services
  const formSchemaService = new FormSchemaService(categoryRepository, categoryFieldRepository);
  const fieldService = new FieldService(fieldRepository);
  const categoryService = new CategoryService(
    categoryRepository,
    categoryFieldRepository,
    fieldRepository,
    formSchemaService,
  );
  const listingService = new ListingService(
    listingRepository,
    categoryRepository,
    formSchemaService,
    env.demoSeller,
  );

  // HTTP
  return {
    categoryController: new CategoryController(categoryService),
    fieldController: new FieldController(fieldService),
    listingController: new ListingController(listingService),
    uploadController: new UploadController(uploadService),
  };
}

export type Container = ReturnType<typeof buildContainer>;
