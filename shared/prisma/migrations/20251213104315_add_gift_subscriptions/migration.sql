-- CreateTable
CREATE TABLE "gift_subscriptions" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "planId" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "createdByUserId" INTEGER NOT NULL,
    "redeemedByUserId" INTEGER,

    CONSTRAINT "gift_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gift_subscriptions_token_key" ON "gift_subscriptions"("token");

-- CreateIndex
CREATE INDEX "gift_subscriptions_createdByUserId_createdAt_idx" ON "gift_subscriptions"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "gift_subscriptions_redeemedByUserId_redeemedAt_idx" ON "gift_subscriptions"("redeemedByUserId", "redeemedAt");

-- AddForeignKey
ALTER TABLE "gift_subscriptions" ADD CONSTRAINT "gift_subscriptions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_subscriptions" ADD CONSTRAINT "gift_subscriptions_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
