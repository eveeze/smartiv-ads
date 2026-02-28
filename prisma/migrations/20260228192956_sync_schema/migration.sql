-- AlterTable
ALTER TABLE "campaign_items" ADD COLUMN     "placementId" INTEGER;

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "categoryId" INTEGER;

-- AlterTable
ALTER TABLE "media" ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "previewUrl" TEXT;

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "revenueSharePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "media_tags" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "media_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_placements" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "allowedMediaTypes" "MediaType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industry_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "industry_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publisher_ledger" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "totalImpressions" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publisher_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MediaTags" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_MediaTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_PropertyBlocklist" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PropertyBlocklist_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_tags_name_key" ON "media_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ad_placements_code_key" ON "ad_placements"("code");

-- CreateIndex
CREATE UNIQUE INDEX "industry_categories_name_key" ON "industry_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "industry_categories_code_key" ON "industry_categories"("code");

-- CreateIndex
CREATE INDEX "publisher_ledger_propertyId_idx" ON "publisher_ledger"("propertyId");

-- CreateIndex
CREATE INDEX "publisher_ledger_date_idx" ON "publisher_ledger"("date");

-- CreateIndex
CREATE UNIQUE INDEX "publisher_ledger_propertyId_date_key" ON "publisher_ledger"("propertyId", "date");

-- CreateIndex
CREATE INDEX "_MediaTags_B_index" ON "_MediaTags"("B");

-- CreateIndex
CREATE INDEX "_PropertyBlocklist_B_index" ON "_PropertyBlocklist"("B");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "campaign_items_campaignId_idx" ON "campaign_items"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_items_mediaId_idx" ON "campaign_items"("mediaId");

-- CreateIndex
CREATE INDEX "campaigns_advertiserId_idx" ON "campaigns"("advertiserId");

-- CreateIndex
CREATE INDEX "campaigns_propertyId_idx" ON "campaigns"("propertyId");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_categoryId_idx" ON "campaigns"("categoryId");

-- CreateIndex
CREATE INDEX "impression_logs_screenId_idx" ON "impression_logs"("screenId");

-- CreateIndex
CREATE INDEX "impression_logs_campaignId_idx" ON "impression_logs"("campaignId");

-- CreateIndex
CREATE INDEX "impression_logs_timestamp_idx" ON "impression_logs"("timestamp");

-- CreateIndex
CREATE INDEX "media_uploaderId_idx" ON "media"("uploaderId");

-- CreateIndex
CREATE INDEX "media_status_idx" ON "media"("status");

-- CreateIndex
CREATE INDEX "properties_classification_idx" ON "properties"("classification");

-- CreateIndex
CREATE INDEX "rate_cards_propertyId_targetSlot_isActive_idx" ON "rate_cards"("propertyId", "targetSlot", "isActive");

-- CreateIndex
CREATE INDEX "screens_propertyId_idx" ON "screens"("propertyId");

-- CreateIndex
CREATE INDEX "screens_status_idx" ON "screens"("status");

-- CreateIndex
CREATE INDEX "transactions_walletId_idx" ON "transactions"("walletId");

-- CreateIndex
CREATE INDEX "users_propertyId_idx" ON "users"("propertyId");

-- CreateIndex
CREATE INDEX "withdrawal_requests_status_idx" ON "withdrawal_requests"("status");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "industry_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_items" ADD CONSTRAINT "campaign_items_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "ad_placements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publisher_ledger" ADD CONSTRAINT "publisher_ledger_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MediaTags" ADD CONSTRAINT "_MediaTags_A_fkey" FOREIGN KEY ("A") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MediaTags" ADD CONSTRAINT "_MediaTags_B_fkey" FOREIGN KEY ("B") REFERENCES "media_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PropertyBlocklist" ADD CONSTRAINT "_PropertyBlocklist_A_fkey" FOREIGN KEY ("A") REFERENCES "industry_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PropertyBlocklist" ADD CONSTRAINT "_PropertyBlocklist_B_fkey" FOREIGN KEY ("B") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
