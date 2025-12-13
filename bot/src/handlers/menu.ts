import { Bot, InlineKeyboard } from 'grammy';
import type { BotContext } from '../types';
import { getMainMenuKeyboard, getSubscriptionKeyboard, getBackToMenuKeyboard, getGiftPlansKeyboard } from '../keyboards';
import { getMessage } from '../services/messages';
import { showDiaryList } from './diary';
import { requireAccess } from '../services/access';

export function setupMenuHandlers(bot: Bot<BotContext>) {
  const TRIAL_DAYS = 7;

  // Кнопка "Канал"
  bot.callbackQuery('menu_channel', async (ctx) => {
    const channelUrl = process.env.TELEGRAM_CHANNEL_URL || 'https://t.me/your_channel';
    const defaultText = `📢 Наш Telegram канал:\n\n${channelUrl}\n\nПодписывайся, чтобы быть в курсе всех новостей!`;
    
    let text = await getMessage('menu_channel', defaultText);
    text = text.replace('{channel_url}', channelUrl);

    await ctx.reply(text, { reply_markup: getBackToMenuKeyboard() });
    await ctx.answerCallbackQuery();
  });

  // Кнопка "Подписка"
  bot.callbackQuery('menu_subscription', async (ctx) => {
    const user = ctx.dbUser;
    const subscription = user?.subscription;
    
    // Проверяем, есть ли активная платная подписка (isActive + expiresAt > now)
    // Или активный триал? (isActive + expiresAt is null + days < 7)
    // ТЗ: "No subscription? then you should have buttons for a week, a month, 80 days and technical support and exit."
    // Если подписка активна - просто пишем статус.
    
    const now = new Date();
    const isPaidActive = subscription?.isActive && subscription.expiresAt && subscription.expiresAt > now;
    const isTrialActive = subscription?.isActive && !isPaidActive; // Упрощенно считаем триалом, если активна но не платно (или срок не истек)
    
    let statusText = '💎 Подписка\n\n';
    let keyboard;

    if (isPaidActive) {
      const expiresAt = subscription!.expiresAt!.toLocaleDateString('ru-RU');
      statusText += `✅ Статус: Активна\n📅 Действует до: ${expiresAt}\n\nСпасибо, что вы с нами!`;
      keyboard = getBackToMenuKeyboard();
    } else if (isTrialActive) {
        // Триал (или просто активная без даты, считаем триалом)
        const daysUsed = subscription?.trialDaysUsed || 0;
        statusText += `✅ Статус: Пробный период\n📅 День: ${Math.min(daysUsed, TRIAL_DAYS)}/${TRIAL_DAYS}\n\nВы можете продлить подписку заранее:`;
        keyboard = getSubscriptionKeyboard(); // Показываем тарифы
    } else {
      statusText += `❌ Статус: Не активна\n\nВыберите подходящий тариф для продолжения:`;
      keyboard = getSubscriptionKeyboard(); // Показываем тарифы
    }
    
    try {
      await ctx.editMessageText(statusText, {
        reply_markup: keyboard
      });
    } catch (e) {
      await ctx.reply(statusText, {
        reply_markup: keyboard
      });
    }
    await ctx.answerCallbackQuery();
  });

  // Кнопка "Техподдержка"
  bot.callbackQuery('menu_support', async (ctx) => {
    const supportBot = process.env.TECH_SUPPORT_BOT || '@your_support_bot';
    const defaultText = `🆘 Техподдержка\n\nДля связи с технической поддержкой, напишите боту: ${supportBot}\n\nМы ответим вам в ближайшее время!`;
    
    let text = await getMessage('menu_support', defaultText);
    text = text.replace('{support_bot}', supportBot);

    await ctx.reply(text, { reply_markup: getBackToMenuKeyboard() });
    await ctx.answerCallbackQuery();
  });

  // Кнопка "Подарить подписку"
  bot.callbackQuery('menu_gift', async (ctx) => {
    const text = '🎁 Подарить подписку\n\nВыберите тариф. После оплаты бот выдаст ссылку, которую можно переслать другу.';
    try {
      await ctx.editMessageText(text, { reply_markup: getGiftPlansKeyboard() });
    } catch (e) {
      await ctx.reply(text, { reply_markup: getGiftPlansKeyboard() });
    }
    await ctx.answerCallbackQuery();
  });

  // Кнопка "Дневник наблюдений"
  bot.callbackQuery('menu_diary', async (ctx) => {
    if (!await requireAccess(ctx)) {
        await ctx.answerCallbackQuery();
        return;
    }
    await showDiaryList(ctx);
    await ctx.answerCallbackQuery();
  });

  // Кнопка "Обсудить" (Просто режим диалога)
  bot.callbackQuery('menu_discuss', async (ctx) => {
    if (!await requireAccess(ctx)) {
        await ctx.answerCallbackQuery();
        return;
    }

    ctx.session.step = 'chatting_with_ai';
    ctx.session.data.aiContext = undefined; // Общий контекст

    const keyboard = new InlineKeyboard()
        .text('❌ Закончить обсуждение', 'stop_ai_chat');

    await ctx.reply(
        `🧠 Режим обсуждения включен.\n\n` +
        `Я готов пообщаться на тему Трансерфинга.\n` +
        `Задавайте свои вопросы или делитесь мыслями.`,
        { reply_markup: keyboard }
    );
    await ctx.answerCallbackQuery();
  });

  // Кнопка "Назад в меню"
  bot.callbackQuery('menu_main', async (ctx) => {
    const defaultText = '📋 Главное меню';
    const text = await getMessage('menu_main', defaultText);

    try {
      await ctx.editMessageText(text, {
        reply_markup: getMainMenuKeyboard()
      });
    } catch (e) {
      await ctx.reply(text, {
        reply_markup: getMainMenuKeyboard()
      });
    }
    await ctx.answerCallbackQuery();
  });
}
