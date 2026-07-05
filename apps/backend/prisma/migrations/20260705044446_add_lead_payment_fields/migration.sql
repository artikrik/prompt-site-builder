-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "easyweekApiKey" TEXT,
ADD COLUMN     "easyweekEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monobankApiKey" TEXT,
ADD COLUMN     "monobankEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wayforpayEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wayforpayMerchant" TEXT,
ADD COLUMN     "wayforpaySecret" TEXT;

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");
