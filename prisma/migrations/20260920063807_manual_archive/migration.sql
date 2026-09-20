-- CreateTable
CREATE TABLE "Archive" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dateFrom" DATETIME NOT NULL,
    "dateTo" DATETIME NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT
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
    "weight" REAL NOT NULL DEFAULT 1,
    "addedByUserId" TEXT,
    "periodId" TEXT,
    "archiveId" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Activity_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Activity_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "Archive" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Activity" ("addedByUserId", "category", "createdAt", "date", "difficulty", "id", "isNight", "mode", "name", "perAttendanceValue", "periodId", "status", "weight") SELECT "addedByUserId", "category", "createdAt", "date", "difficulty", "id", "isNight", "mode", "name", "perAttendanceValue", "periodId", "status", "weight" FROM "Activity";
DROP TABLE "Activity";
ALTER TABLE "new_Activity" RENAME TO "Activity";
CREATE INDEX "Activity_archiveId_idx" ON "Activity"("archiveId");
CREATE INDEX "Activity_periodId_idx" ON "Activity"("periodId");
CREATE TABLE "new_TreasuryTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "category" TEXT,
    "kind" TEXT,
    "periodId" TEXT,
    "archiveId" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TreasuryTransaction_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TreasuryTransaction_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "Archive" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TreasuryTransaction" ("amount", "category", "createdAt", "date", "description", "id", "kind", "periodId") SELECT "amount", "category", "createdAt", "date", "description", "id", "kind", "periodId" FROM "TreasuryTransaction";
DROP TABLE "TreasuryTransaction";
ALTER TABLE "new_TreasuryTransaction" RENAME TO "TreasuryTransaction";
CREATE INDEX "TreasuryTransaction_periodId_idx" ON "TreasuryTransaction"("periodId");
CREATE INDEX "TreasuryTransaction_archiveId_idx" ON "TreasuryTransaction"("archiveId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
