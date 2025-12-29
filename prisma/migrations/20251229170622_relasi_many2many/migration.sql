-- CreateTable
CREATE TABLE "_CampaignToScreen" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CampaignToScreen_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CampaignToScreen_B_index" ON "_CampaignToScreen"("B");

-- AddForeignKey
ALTER TABLE "_CampaignToScreen" ADD CONSTRAINT "_CampaignToScreen_A_fkey" FOREIGN KEY ("A") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CampaignToScreen" ADD CONSTRAINT "_CampaignToScreen_B_fkey" FOREIGN KEY ("B") REFERENCES "screens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
