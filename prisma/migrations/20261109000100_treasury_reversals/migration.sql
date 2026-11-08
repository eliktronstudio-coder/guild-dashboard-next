-- Additive audit linkage. Existing rows and amounts remain unchanged.
ALTER TABLE "TreasuryTransaction" ADD COLUMN "reversalOfId" TEXT;
CREATE UNIQUE INDEX "TreasuryTransaction_reversalOfId_key" ON "TreasuryTransaction"("reversalOfId");
