-- AlterTable
ALTER TABLE "users" ADD COLUMN     "gender" TEXT,
ADD COLUMN     "isIntroCompleted" BOOLEAN NOT NULL DEFAULT false;
