-- CreateEnum
CREATE TYPE "AddonType" AS ENUM ('ONLINE_PAYMENT', 'ONLINE_BOOKING', 'CONTENT_MANAGEMENT');

-- CreateEnum
CREATE TYPE "AddonStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "ProjectAddon" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "addonType" "AddonType" NOT NULL,
    "status" "AddonStatus" NOT NULL DEFAULT 'ACTIVE',
    "config" JSONB NOT NULL DEFAULT '{}',
    "priceMonthly" DECIMAL(65,30) DEFAULT 0,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectAddon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAddon_projectId_addonType_key" ON "ProjectAddon"("projectId", "addonType");

-- CreateIndex
CREATE INDEX "ProjectAddon_projectId_idx" ON "ProjectAddon"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectAddon" ADD CONSTRAINT "ProjectAddon_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
