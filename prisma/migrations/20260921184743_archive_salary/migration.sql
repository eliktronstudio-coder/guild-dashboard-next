-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ArchivePlayerStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "archiveId" TEXT NOT NULL,
    "playerId" TEXT,
    "playerName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "attendancePct" INTEGER NOT NULL,
    "attendancePctPrime" INTEGER NOT NULL,
    "attendancePctMiniRb" INTEGER NOT NULL,
    "pvpCount" INTEGER NOT NULL DEFAULT 0,
    "salaryPrime" INTEGER NOT NULL DEFAULT 0,
    "salaryMiniRb" INTEGER NOT NULL DEFAULT 0,
    "attended" INTEGER NOT NULL DEFAULT 0,
    "activitiesTotal" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ArchivePlayerStat_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "Archive" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArchivePlayerStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ArchivePlayerStat" ("activitiesTotal", "archiveId", "attendancePct", "attendancePctMiniRb", "attendancePctPrime", "attended", "id", "playerId", "playerName", "pvpCount", "role") SELECT "activitiesTotal", "archiveId", "attendancePct", "attendancePctMiniRb", "attendancePctPrime", "attended", "id", "playerId", "playerName", "pvpCount", "role" FROM "ArchivePlayerStat";
DROP TABLE "ArchivePlayerStat";
ALTER TABLE "new_ArchivePlayerStat" RENAME TO "ArchivePlayerStat";
CREATE INDEX "ArchivePlayerStat_archiveId_idx" ON "ArchivePlayerStat"("archiveId");
CREATE INDEX "ArchivePlayerStat_playerId_idx" ON "ArchivePlayerStat"("playerId");
CREATE UNIQUE INDEX "ArchivePlayerStat_archiveId_playerName_key" ON "ArchivePlayerStat"("archiveId", "playerName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
