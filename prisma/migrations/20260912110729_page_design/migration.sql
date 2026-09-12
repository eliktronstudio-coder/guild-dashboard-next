-- CreateTable
CREATE TABLE "PageDesign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageKey" TEXT NOT NULL,
    "draftJson" TEXT NOT NULL DEFAULT '{}',
    "publishedJson" TEXT NOT NULL DEFAULT '{}',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "draftUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "draftUpdatedBy" TEXT,
    "publishedAt" DATETIME,
    "publishedBy" TEXT
);

-- CreateTable
CREATE TABLE "DesignVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageDesignId" TEXT NOT NULL,
    "configJson" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "authorName" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DesignVersion_pageDesignId_fkey" FOREIGN KEY ("pageDesignId") REFERENCES "PageDesign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PageDesign_pageKey_key" ON "PageDesign"("pageKey");

-- CreateIndex
CREATE INDEX "DesignVersion_pageDesignId_createdAt_idx" ON "DesignVersion"("pageDesignId", "createdAt");
