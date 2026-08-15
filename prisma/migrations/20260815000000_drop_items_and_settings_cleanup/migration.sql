-- CreateTable
CREATE TABLE "DropItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activityId" TEXT,
    "playerId" TEXT,
    CONSTRAINT "DropItem_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DropItem_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GuildSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "nextPayoutDate" DATETIME
);
INSERT INTO "new_GuildSettings" ("id", "nextPayoutDate") SELECT "id", "nextPayoutDate" FROM "GuildSettings";
DROP TABLE "GuildSettings";
ALTER TABLE "new_GuildSettings" RENAME TO "GuildSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
