-- CreateTable
CREATE TABLE "price_change_history" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "oldPriceCents" INTEGER NOT NULL,
    "newPriceCents" INTEGER NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_change_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_change_history_listId_idx" ON "price_change_history"("listId");

-- CreateIndex
CREATE INDEX "price_change_history_changedAt_idx" ON "price_change_history"("changedAt");

-- AddForeignKey
ALTER TABLE "price_change_history" ADD CONSTRAINT "price_change_history_listId_fkey" FOREIGN KEY ("listId") REFERENCES "lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

