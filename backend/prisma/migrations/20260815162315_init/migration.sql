-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'SELECT', 'MULTISELECT', 'RADIO', 'BOOLEAN', 'DATE');

-- CreateEnum
CREATE TYPE "ListingCondition" AS ENUM ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SOLD', 'ARCHIVED');

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fields" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "helpText" TEXT,
    "type" "FieldType" NOT NULL,
    "unit" TEXT,
    "validation" JSONB NOT NULL DEFAULT '{}',
    "defaultValue" TEXT,
    "placeholder" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_options" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_fields" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "section" TEXT NOT NULL DEFAULT 'Details',
    "showInCard" BOOLEAN NOT NULL DEFAULT false,
    "visibilityRule" JSONB,
    "overrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "condition" "ListingCondition" NOT NULL,
    "city" TEXT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "schemaSnapshot" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_images" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT,
    "alt" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE INDEX "categories_isActive_sortOrder_idx" ON "categories"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "fields_key_key" ON "fields"("key");

-- CreateIndex
CREATE INDEX "fields_isActive_idx" ON "fields"("isActive");

-- CreateIndex
CREATE INDEX "field_options_fieldId_sortOrder_idx" ON "field_options"("fieldId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "field_options_fieldId_value_key" ON "field_options"("fieldId", "value");

-- CreateIndex
CREATE INDEX "category_fields_categoryId_sortOrder_idx" ON "category_fields"("categoryId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "category_fields_categoryId_fieldId_key" ON "category_fields"("categoryId", "fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "listings_slug_key" ON "listings"("slug");

-- CreateIndex
CREATE INDEX "listings_status_createdAt_idx" ON "listings"("status", "createdAt");

-- CreateIndex
CREATE INDEX "listings_categoryId_status_createdAt_idx" ON "listings"("categoryId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "listings_attributes_idx" ON "listings" USING GIN ("attributes");

-- CreateIndex
CREATE INDEX "listing_images_listingId_sortOrder_idx" ON "listing_images"("listingId", "sortOrder");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_options" ADD CONSTRAINT "field_options_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_fields" ADD CONSTRAINT "category_fields_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_fields" ADD CONSTRAINT "category_fields_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_images" ADD CONSTRAINT "listing_images_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
