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
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Activity_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Activity" ("addedByUserId", "category", "createdAt", "date", "difficulty", "id", "isNight", "mode", "name", "perAttendanceValue", "periodId", "status") SELECT "addedByUserId", "category", "createdAt", "date", "difficulty", "id", "isNight", "mode", "name", "perAttendanceValue", "periodId", "status" FROM "Activity";
DROP TABLE "Activity";
ALTER TABLE "new_Activity" RENAME TO "Activity";
CREATE INDEX "Activity_periodId_idx" ON "Activity"("periodId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
