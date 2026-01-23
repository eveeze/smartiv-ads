-- CreateEnum
CREATE TYPE "DurationPackage" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM');

-- AlterTable
ALTER TABLE "campaign_items" ADD COLUMN     "actionUrl" TEXT;

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "durationPackage" "DurationPackage" NOT NULL DEFAULT 'CUSTOM',
ADD COLUMN     "targetSlot" "AdSlot" NOT NULL DEFAULT 'SCREENSAVER';

-- AlterTable
ALTER TABLE "media" ADD COLUMN     "actionUrl" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "region" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta';

-- AlterTable
ALTER TABLE "rate_cards" ADD COLUMN     "pricePerMonth" BIGINT,
ADD COLUMN     "pricePerWeek" BIGINT;
