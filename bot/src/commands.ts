import { Bot } from 'grammy';
import type { BotContext } from './types';
import { getMainMenuKeyboard } from './keyboards';
import { startIntroduction } from './handlers/introduction';

export function setupCommands(bot: Bot<BotContext>) {
  // Команда /start
  bot.command('start', async (ctx) => {
    const user = ctx.dbUser;
    
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
    if (ctx.dbUser && !ctx.dbUser.isIntroCompleted && ctx.message?.text !== '/start') {
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
