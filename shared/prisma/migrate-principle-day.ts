/**
 * Скрипт для миграции существующих пользователей — установка currentPrincipleDay
 * Запуск: cd shared && bun run prisma/migrate-principle-day.ts
 * 
 * Логика:
 * - Для пользователей с introCompletedAt считаем сколько дней прошло
 * - Если подписка неактивна и триал закончен — ставим 6 (первый платный принцип)
 * - Если подписка активна — ставим daysSinceIntro + 2 (1 принцип при интро + дни)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      isIntroCompleted: true,
      introCompletedAt: { not: null }
    },
    include: { subscription: true }
  });

  console.log(`Найдено ${users.length} пользователей для миграции`);

  const now = new Date();

  for (const user of users) {
    const daysSinceIntro = Math.floor(
      (now.getTime() - new Date(user.introCompletedAt!).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // После интро отправляется принцип 1, на следующий день — 2, и т.д.
    // daysSinceIntro = 0 -> получил 1, следующий 2
    // daysSinceIntro = 1 -> получил 1 и 2, следующий 3
    // и т.д.
    let calculatedDay = daysSinceIntro + 2;
    
    const isActive = user.subscription?.isActive || false;
    const isPaid = user.subscription?.expiresAt && user.subscription.expiresAt > now;
    
    // Если подписка неактивна и не оплачена — ограничиваем 6 (первый платный)
    if (!isActive && !isPaid && calculatedDay > 6) {
      calculatedDay = 6;
    }

    // Вычисляем trialDaysUsed (сколько триальных принципов получено, макс 5)
    // calculatedDay = следующий принцип, значит получено calculatedDay - 1 принципов
    const trialDaysUsed = Math.min(calculatedDay - 1, 5);

    // Обновляем currentPrincipleDay
    if (user.currentPrincipleDay === 1 && calculatedDay !== 1) {
      await prisma.user.update({
        where: { id: user.id },
        data: { currentPrincipleDay: calculatedDay }
      });
      console.log(`User ${user.id}: currentPrincipleDay = ${calculatedDay} (days since intro: ${daysSinceIntro}, active: ${isActive})`);
    } else {
      console.log(`User ${user.id}: currentPrincipleDay пропущен (уже ${user.currentPrincipleDay})`);
    }
    
    // Обновляем trialDaysUsed в подписке
    if (user.subscription) {
      await prisma.subscription.update({
        where: { userId: user.id },
        data: { trialDaysUsed }
      });
      console.log(`User ${user.id}: trialDaysUsed = ${trialDaysUsed}`);
    }
  }

  console.log('Миграция завершена!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

