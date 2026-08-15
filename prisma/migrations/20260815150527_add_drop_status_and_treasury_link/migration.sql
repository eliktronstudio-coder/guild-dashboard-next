-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DropItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "value" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Не продано',
    "treasuryTransactionId" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activityId" TEXT,
    "playerId" TEXT,
    CONSTRAINT "DropItem_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DropItem_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DropItem" ("activityId", "createdAt", "date", "id", "item", "playerId", "quantity", "value") SELECT "activityId", "createdAt", "date", "id", "item", "playerId", "quantity", "value" FROM "DropItem";
DROP TABLE "DropItem";
ALTER TABLE "new_DropItem" RENAME TO "DropItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
