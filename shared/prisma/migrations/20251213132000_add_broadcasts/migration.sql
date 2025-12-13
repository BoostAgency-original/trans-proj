-- CreateTable
CREATE TABLE "broadcasts" (
    "id" SERIAL NOT NULL,
    "audience" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "parseMode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalTargets" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "lastProcessedUserId" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "broadcasts_status_createdAt_idx" ON "broadcasts"("status", "createdAt");


