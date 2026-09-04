-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ActivityBanner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "isVideo" BOOLEAN NOT NULL DEFAULT false,
    "height" INTEGER,
    "widthPct" INTEGER,
    "imgWidth" INTEGER,
    "imgHeight" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ActivityBanner" ("createdAt", "height", "id", "imageUrl", "imgHeight", "imgWidth", "name", "widthPct") SELECT "createdAt", "height", "id", "imageUrl", "imgHeight", "imgWidth", "name", "widthPct" FROM "ActivityBanner";
DROP TABLE "ActivityBanner";
ALTER TABLE "new_ActivityBanner" RENAME TO "ActivityBanner";
CREATE UNIQUE INDEX "ActivityBanner_name_key" ON "ActivityBanner"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
