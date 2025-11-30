/*
  Warnings:

  - You are about to drop the column `principle` on the `diary_entries` table. All the data in the column will be lost.
  - Added the required column `dayNumber` to the `diary_entries` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "diary_entries_userId_principle_idx";

-- AlterTable
ALTER TABLE "diary_entries" DROP COLUMN "principle",
ADD COLUMN     "dayNumber" INTEGER NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'general';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "introCompletedAt" TIMESTAMP(3),
ADD COLUMN     "nextMorningMessageAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "principles" (
    "id" SERIAL NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "declaration" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "principles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "principles_dayNumber_key" ON "principles"("dayNumber");

-- CreateIndex
CREATE INDEX "diary_entries_userId_dayNumber_idx" ON "diary_entries"("userId", "dayNumber");
