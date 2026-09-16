-- CreateTable
CREATE TABLE "PayoutSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "period" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "salaryPrime" INTEGER NOT NULL,
    "salaryMiniRb" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PayoutSnapshot_period_playerId_key" ON "PayoutSnapshot"("period", "playerId");
