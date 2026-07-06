-- CreateEnum
CREATE TYPE "VariantStatus" AS ENUM ('DRAFT', 'GENERATING', 'GENERATED', 'PUBLISHED');

-- AlterTable: Lead enrichment fields
ALTER TABLE "Lead"
  ADD COLUMN "enrichmentData" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "enrichedAt" TIMESTAMP(3),
  ADD COLUMN "enrichmentSources" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable: SiteVariant
CREATE TABLE "SiteVariant" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "status" "VariantStatus" NOT NULL DEFAULT 'DRAFT',
    "hugoConfig" JSONB NOT NULL DEFAULT '{}',
    "content" JSONB NOT NULL DEFAULT '{}',
    "modelUsed" TEXT,
    "imageModel" TEXT,
    "themeName" TEXT,
    "previewUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteVariant_projectId_idx" ON "SiteVariant"("projectId");

-- AlterTable: Project variant fields
ALTER TABLE "Project"
  ADD COLUMN "activeVariantId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Project_activeVariantId_key" ON "Project"("activeVariantId");

-- AlterTable: GenerationJob variantId
ALTER TABLE "GenerationJob"
  ADD COLUMN "variantId" TEXT;

-- AlterTable: SiteAsset variantId
ALTER TABLE "SiteAsset"
  ADD COLUMN "variantId" TEXT;

-- AddForeignKey: SiteVariant → Project
ALTER TABLE "SiteVariant" ADD CONSTRAINT "SiteVariant_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Project → SiteVariant (activeVariant)
ALTER TABLE "Project" ADD CONSTRAINT "Project_activeVariantId_fkey" FOREIGN KEY ("activeVariantId") REFERENCES "SiteVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: GenerationJob → SiteVariant
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "SiteVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: SiteAsset → SiteVariant
ALTER TABLE "SiteAsset" ADD CONSTRAINT "SiteAsset_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "SiteVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
