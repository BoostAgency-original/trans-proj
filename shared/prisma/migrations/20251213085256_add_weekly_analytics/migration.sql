-- CreateTable
CREATE TABLE "weekly_analytics" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "notesDays" INTEGER NOT NULL,
    "notesCount" INTEGER NOT NULL,
    "period" JSONB NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weekly_analytics_userId_createdAt_idx" ON "weekly_analytics"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_analytics_userId_weekNumber_key" ON "weekly_analytics"("userId", "weekNumber");

-- AddForeignKey
ALTER TABLE "weekly_analytics" ADD CONSTRAINT "weekly_analytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
