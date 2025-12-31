-- DropForeignKey
ALTER TABLE "campaign_items" DROP CONSTRAINT "campaign_items_campaignId_fkey";

-- AddForeignKey
ALTER TABLE "campaign_items" ADD CONSTRAINT "campaign_items_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
