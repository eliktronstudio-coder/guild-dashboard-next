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
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Activity" ("createdAt", "date", "id", "name") SELECT "createdAt", "date", "id", "name" FROM "Activity";
DROP TABLE "Activity";
ALTER TABLE "new_Activity" RENAME TO "Activity";
CREATE TABLE "new_DropItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "value" INTEGER NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activityId" TEXT,
    "playerId" TEXT,
    CONSTRAINT "DropItem_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DropItem_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DropItem" ("activityId", "createdAt", "date", "id", "item", "playerId", "value") SELECT "activityId", "createdAt", "date", "id", "item", "playerId", "value" FROM "DropItem";
DROP TABLE "DropItem";
ALTER TABLE "new_DropItem" RENAME TO "DropItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
