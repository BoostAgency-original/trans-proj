import { Bot } from 'grammy';
import type { BotContext } from './types';
import { getMainMenuKeyboard } from './keyboards';
import { startIntroduction } from './handlers/introduction';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function setupCommands(bot: Bot<BotContext>) {
  // Команда /start
  bot.command('start', async (ctx) => {
    const user = ctx.dbUser;
    const payload = (ctx.match || '').trim();

    // Gift redeem via deep-link
    if (payload.startsWith('gift_')) {
      const token = payload.slice('gift_'.length);
      const gift = await prisma.giftSubscription.findUnique({ where: { token } });

      if (!gift) {
        await ctx.reply('❌ Подарок не найден или ссылка неверная.');
        return;
      }
      if (gift.status !== 'paid') {
        await ctx.reply('⏳ Этот подарок ещё не оплачен или уже недоступен.');
        return;
      }
      if (gift.redeemedAt) {
        await ctx.reply('⚠️ Этот подарок уже активирован.');
        return;
      }

      const now = new Date();
      // помечаем как redeemed
      await prisma.giftSubscription.update({
        where: { token },
        data: {
          status: 'redeemed',
          redeemedAt: now,
          redeemedByUserId: user!.id,
        },
      });

      // активируем/продлеваем подписку
      const existing = user?.subscription;
      const base = existing?.expiresAt && existing.expiresAt > now ? existing.expiresAt : now;
      const newExpiresAt = new Date(base);
      newExpiresAt.setDate(newExpiresAt.getDate() + gift.days);

      await prisma.subscription.upsert({
        where: { userId: user!.id },
        update: {
          isActive: true,
          expiresAt: newExpiresAt,
          activatedAt: existing?.activatedAt ?? now,
        },
        create: {
          userId: user!.id,
          isActive: true,
          activatedAt: now,
          expiresAt: newExpiresAt,
          trialDaysUsed: existing?.trialDaysUsed ?? 0,
        },
      });

      // Если интро ещё не пройдено — ведём в интро
      if (!user?.isIntroCompleted) {
        await ctx.reply(
          `🎁 Подарок активирован!\n\n` +
            `Подписка действует до ${newExpiresAt.toLocaleDateString('ru-RU')}.\n\n` +
            `Давай пройдём вводный сценарий — и начнем практику.`
        );
        await startIntroduction(ctx);
        return;
      }

      // Если интро пройдено, но практика ещё не стартовала (introCompletedAt=null) — стартуем и отправим 1-й принцип
      if (user.isIntroCompleted && !user.introCompletedAt) {
        const principle = await prisma.transurfingPrinciple.findUnique({ where: { dayNumber: 1 } });
        await prisma.user.update({
          where: { id: user.id },
          data: {
            introCompletedAt: now,
            currentPrincipleDay: 2,
            lastPrincipleSentAt: now,
          } as any,
        });

        if (principle) {
          const name = user.name || user.firstName || 'друг';
          const message =
            `${name}, поздравляю! Ты начал свой путь.\n\n` +
            `<b>День 1. Принцип: ${principle.title}</b>\n\n` +
            `<b>Декларация:</b>\n\n<blockquote>${principle.declaration}</blockquote>\n\n` +
            `<b>Пояснение:</b>\n${principle.description}\n\n` +
            `<b>Сегодня наблюдай:</b>\n\n${principle.task}`;

          await ctx.reply(message, { parse_mode: 'HTML' });
        }
      }

      await ctx.reply(
        `🎁 Подарок активирован!\n\n` +
          `Подписка действует до ${newExpiresAt.toLocaleDateString('ru-RU')}.\n\n` +
          `Открываю меню 👇`,
        { reply_markup: getMainMenuKeyboard() }
      );
      return;
    }
    
    // Если пользователь новый или не прошел вводный сценарий
    if (!user?.isIntroCompleted) {
      await startIntroduction(ctx);
      return;
    }

    const name = user.name || user.firstName || 'друг';
    
    await ctx.reply(
      `👋 С возвращением, ${name}!\n\n` +
      `Продолжаем практику Трансерфинга.\n\n` +
      `Выбери нужный раздел в меню ⬇️`,
      {
        reply_markup: getMainMenuKeyboard()
      }
    );
  });

  // Middleware для блокировки меню, если интро не пройдено
  bot.use(async (ctx, next) => {
    if (ctx.dbUser && !ctx.dbUser.isIntroCompleted && !ctx.message?.text?.startsWith('/start')) {
      // Разрешаем только ответы на вопросы интро
      const allowedSteps = ['intro_name', 'intro_gender', 'intro_step4', 'intro_step5', 'intro_step6'];
      const currentStep = ctx.session.step;
      const isIntroAction = allowedSteps.includes(currentStep as string) || 
                           ctx.message?.text === '🚀 Готов начать' ||
                           ctx.message?.text === 'Мужской' ||
                           ctx.message?.text === 'Женский' ||
                           ctx.message?.text === 'Да, я готов(а)' ||
                           ctx.message?.text === 'Да' ||
                           ctx.message?.text === 'Да, готов начать';

      if (!isIntroAction) {
        // Если пользователь не в интро, отправляем его туда
        if (!currentStep) {
          await startIntroduction(ctx);
        } else {
          // Иначе просим завершить текущий шаг (молча игнорируем или напоминаем)
          // await ctx.reply('⚠️ Пожалуйста, ответьте на вопрос выше или нажмите /start');
        }
        return;
      }
    }
    await next();
  });

  // Команда /menu
  bot.command('menu', async (ctx) => {
    await ctx.reply(
      '📋 Главное меню:',
      {
        reply_markup: getMainMenuKeyboard()
      }
    );
  });

  // Команда /help
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `ℹ️ Помощь по боту\n\n` +
      `Доступные команды:\n` +
      `/start - Начать работу с ботом\n` +
      `/menu - Показать главное меню\n` +
      `/help - Показать эту справку\n\n` +
      `Используй кнопки меню для навигации.`
    );
  });
}
