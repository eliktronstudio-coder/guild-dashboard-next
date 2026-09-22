/*
  Warnings:

  - You are about to drop the `PayoutSnapshot` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PayoutSnapshot";
PRAGMA foreign_keys=on;
