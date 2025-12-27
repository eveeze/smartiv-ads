/*
  Warnings:

  - The values [HTML] on the enum `MediaType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `targetZone` on the `campaign_items` table. All the data in the column will be lost.
  - You are about to drop the column `targetZone` on the `rate_cards` table. All the data in the column will be lost.
  - You are about to drop the column `macAddress` on the `screens` table. All the data in the column will be lost.
  - You are about to drop the column `zone` on the `screens` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[smartivId]` on the table `properties` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[smartivCode]` on the table `properties` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `screens` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `targetSlot` to the `campaign_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `screens` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AdSlot" AS ENUM ('SCREENSAVER', 'INFO_SLIDER', 'APP_PROMOTION', 'LEISURE_CULINARY', 'LEISURE_TOURISM', 'LEISURE_GIFT', 'WELCOME_GREETING', 'BACKGROUND');

-- AlterEnum
BEGIN;
CREATE TYPE "MediaType_new" AS ENUM ('IMAGE', 'VIDEO');
ALTER TABLE "media" ALTER COLUMN "type" TYPE "MediaType_new" USING ("type"::text::"MediaType_new");
ALTER TYPE "MediaType" RENAME TO "MediaType_old";
ALTER TYPE "MediaType_new" RENAME TO "MediaType";
DROP TYPE "public"."MediaType_old";
COMMIT;

-- DropIndex
DROP INDEX "screens_macAddress_key";

-- AlterTable
ALTER TABLE "campaign_items" DROP COLUMN "targetZone",
ADD COLUMN     "targetSlot" "AdSlot" NOT NULL;

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "propertyId" INTEGER;

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "activeColor" TEXT,
ADD COLUMN     "baseColor" TEXT,
ADD COLUMN     "enabledSlots" "AdSlot"[] DEFAULT ARRAY['SCREENSAVER']::"AdSlot"[],
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "smartivCode" TEXT,
ADD COLUMN     "smartivId" INTEGER;

-- AlterTable
ALTER TABLE "rate_cards" DROP COLUMN "targetZone",
ADD COLUMN     "targetSlot" "AdSlot";

-- AlterTable
ALTER TABLE "screens" DROP COLUMN "macAddress",
DROP COLUMN "zone",
ADD COLUMN     "code" TEXT NOT NULL;

-- DropEnum
DROP TYPE "AdZone";

-- CreateIndex
CREATE UNIQUE INDEX "properties_smartivId_key" ON "properties"("smartivId");

-- CreateIndex
CREATE UNIQUE INDEX "properties_smartivCode_key" ON "properties"("smartivCode");

-- CreateIndex
CREATE UNIQUE INDEX "screens_code_key" ON "screens"("code");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
