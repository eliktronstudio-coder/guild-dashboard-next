-- CreateTable
CREATE TABLE "DesignSnippet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT
);

-- CreateIndex
CREATE INDEX "DesignSnippet_createdAt_idx" ON "DesignSnippet"("createdAt");
