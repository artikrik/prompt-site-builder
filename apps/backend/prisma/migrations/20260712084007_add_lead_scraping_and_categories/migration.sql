/*
  Warnings:

  - You are about to drop the column `socialUrl` on the `Lead` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Lead" DROP COLUMN "socialUrl",
ADD COLUMN     "country" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "scrapedContacts" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "scrapedHours" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "scrapedPhotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "scrapedReviews" JSONB[] DEFAULT ARRAY[]::JSONB[],
ADD COLUMN     "scrapingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "socialUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "CategoryPrompt" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "contentPrompt" TEXT NOT NULL,
    "designPrompt" TEXT NOT NULL,
    "competitorPrompt" TEXT NOT NULL,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryPrompt_category_key" ON "CategoryPrompt"("category");
