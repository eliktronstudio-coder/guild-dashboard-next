/*
  Warnings:

  - You are about to drop the `ArchiveSnapshot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `archivePeriodId` on the `Payment` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ArchiveSnapshot_periodId_playerId_key";

-- DropIndex
DROP INDEX "ArchiveSnapshot_periodId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ArchiveSnapshot";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Ожидает',
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "archiveMonth" TEXT,
    "category" TEXT,
    "periodId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "archiveMonth", "category", "createdAt", "date", "id", "periodId", "playerId", "source", "status") SELECT "amount", "archiveMonth", "category", "createdAt", "date", "id", "periodId", "playerId", "source", "status" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE INDEX "Payment_periodId_idx" ON "Payment"("periodId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
