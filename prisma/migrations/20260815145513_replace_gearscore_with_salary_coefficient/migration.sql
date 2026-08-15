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
CREATE TABLE "new_Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "attendancePct" INTEGER NOT NULL DEFAULT 0,
    "salaryCoefficient" REAL NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Player" ("attendancePct", "createdAt", "id", "level", "name", "role", "userId", "xp") SELECT "attendancePct", "createdAt", "id", "level", "name", "role", "userId", "xp" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE UNIQUE INDEX "Player_userId_key" ON "Player"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
