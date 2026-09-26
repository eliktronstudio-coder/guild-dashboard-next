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
    "bossKey" TEXT,
    "bossKillConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "killCount" INTEGER NOT NULL DEFAULT 1,
    "pvpResult" TEXT,
    "pvpGuildRaid" BOOLEAN NOT NULL DEFAULT false,
    "guildDefense" BOOLEAN NOT NULL DEFAULT false,
    "organizerPlayerId" TEXT,
    "raidLeaderPlayerId" TEXT,
    CONSTRAINT "Activity_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Activity_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Activity_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "Archive" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Activity_organizerPlayerId_fkey" FOREIGN KEY ("organizerPlayerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Activity_raidLeaderPlayerId_fkey" FOREIGN KEY ("raidLeaderPlayerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Activity" ("addedByUserId", "archiveId", "category", "createdAt", "date", "difficulty", "id", "isNight", "mode", "name", "perAttendanceValue", "periodId", "status", "weight") SELECT "addedByUserId", "archiveId", "category", "createdAt", "date", "difficulty", "id", "isNight", "mode", "name", "perAttendanceValue", "periodId", "status", "weight" FROM "Activity";
DROP TABLE "Activity";
ALTER TABLE "new_Activity" RENAME TO "Activity";
CREATE INDEX "Activity_archiveId_idx" ON "Activity"("archiveId");
CREATE INDEX "Activity_periodId_idx" ON "Activity"("periodId");
CREATE INDEX "Activity_bossKey_idx" ON "Activity"("bossKey");
CREATE INDEX "Activity_organizerPlayerId_idx" ON "Activity"("organizerPlayerId");
CREATE INDEX "Activity_raidLeaderPlayerId_idx" ON "Activity"("raidLeaderPlayerId");
CREATE TABLE "new_ActivityParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "fullParticipation" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ActivityParticipant_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityParticipant_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ActivityParticipant" ("activityId", "id", "playerId") SELECT "activityId", "id", "playerId" FROM "ActivityParticipant";
DROP TABLE "ActivityParticipant";
ALTER TABLE "new_ActivityParticipant" RENAME TO "ActivityParticipant";
CREATE UNIQUE INDEX "ActivityParticipant_activityId_playerId_key" ON "ActivityParticipant"("activityId", "playerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
