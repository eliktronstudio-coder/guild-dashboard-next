-- CreateTable
CREATE TABLE "AccountingPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "closedAt" DATETIME,
    "closedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ArchiveSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "accruedPrime" INTEGER NOT NULL,
    "accruedMiniRb" INTEGER NOT NULL,
    "paidPrime" INTEGER NOT NULL DEFAULT 0,
    "paidMiniRb" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArchiveSnapshot_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Мини-РБ',
    "mode" TEXT NOT NULL DEFAULT 'PvE',
    "difficulty" TEXT NOT NULL DEFAULT 'Обычная',
    "status" TEXT NOT NULL DEFAULT 'К выплате',
    "isNight" BOOLEAN NOT NULL DEFAULT false,
    "perAttendanceValue" INTEGER NOT NULL DEFAULT 0,
    "addedByUserId" TEXT,
    "periodId" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Activity_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Activity" ("addedByUserId", "category", "createdAt", "date", "difficulty", "id", "isNight", "mode", "name", "perAttendanceValue", "status") SELECT "addedByUserId", "category", "createdAt", "date", "difficulty", "id", "isNight", "mode", "name", "perAttendanceValue", "status" FROM "Activity";
DROP TABLE "Activity";
ALTER TABLE "new_Activity" RENAME TO "Activity";
CREATE INDEX "Activity_periodId_idx" ON "Activity"("periodId");
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
    "archivePeriodId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "archiveMonth", "category", "createdAt", "date", "id", "playerId", "source", "status") SELECT "amount", "archiveMonth", "category", "createdAt", "date", "id", "playerId", "source", "status" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE INDEX "Payment_periodId_idx" ON "Payment"("periodId");
CREATE INDEX "Payment_archivePeriodId_idx" ON "Payment"("archivePeriodId");
CREATE TABLE "new_TreasuryTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "category" TEXT,
    "kind" TEXT,
    "periodId" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TreasuryTransaction_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TreasuryTransaction" ("amount", "category", "createdAt", "date", "description", "id", "kind") SELECT "amount", "category", "createdAt", "date", "description", "id", "kind" FROM "TreasuryTransaction";
DROP TABLE "TreasuryTransaction";
ALTER TABLE "new_TreasuryTransaction" RENAME TO "TreasuryTransaction";
CREATE INDEX "TreasuryTransaction_periodId_idx" ON "TreasuryTransaction"("periodId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AccountingPeriod_status_idx" ON "AccountingPeriod"("status");

-- CreateIndex
CREATE INDEX "ArchiveSnapshot_periodId_idx" ON "ArchiveSnapshot"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveSnapshot_periodId_playerId_key" ON "ArchiveSnapshot"("periodId", "playerId");
