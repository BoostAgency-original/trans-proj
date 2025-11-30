import { Bot } from 'grammy';
import { PrismaClient } from '@prisma/client';
import type { BotContext } from '../types';
import { 
    getSettingsKeyboard, 
    getTimezoneKeyboard, 
    getCancelKeyboard
} from '../keyboards';
import { getMessage } from '../services/messages';

const prisma = new PrismaClient();

export function setupSettingsHandlers(bot: Bot<BotContext>) {
  
  // Главное меню настроек
  bot.callbackQuery('menu_settings', async (ctx) => {
      const text = await getMessage('settings_menu_title', '⚙️ Настройки\n\nВыберите пункт для изменения:');
      try {
          await ctx.editMessageText(text, { reply_markup: getSettingsKeyboard() });
      } catch (e) {
          await ctx.reply(text, { reply_markup: getSettingsKeyboard() });
      }
      await ctx.answerCallbackQuery();
  });

  // --- Изменение имени ---
  bot.callbackQuery('settings_edit_name', async (ctx) => {
      ctx.session.step = 'waiting_for_settings_name';
      const text = await getMessage('settings_edit_name_prompt', 'Введите новое имя:');
      await ctx.editMessageText(text, { reply_markup: getCancelKeyboard() });
      await ctx.answerCallbackQuery();
  });

  // Обработка ввода имени
  bot.on('message:text', async (ctx, next) => {
      if (ctx.session.step === 'waiting_for_settings_name') {
          const newName = ctx.message.text;
          
          await prisma.user.update({
              where: { id: ctx.dbUser!.id },
              data: { name: newName }
          });
          
          ctx.session.step = undefined;
          const savedText = await getMessage('settings_saved', '✅ Настройки сохранены!');
          
          await ctx.reply(`${savedText}\nВаше новое имя: ${newName}`, {
              reply_markup: getSettingsKeyboard()
          });
          return;
      }
      await next();
  });

  // --- Изменение пола --- (REMOVED)
  /*
  bot.callbackQuery('settings_edit_gender', async (ctx) => {
      // ... logic removed
  });

  bot.callbackQuery(/^settings_gender_(male|female)$/, async (ctx) => {
     // ... logic removed
  });
  */

  // --- Изменение времени (часового пояса) ---
  bot.callbackQuery('settings_edit_time', async (ctx) => {
      const text = await getMessage('settings_edit_time_prompt', 'Выберите ваш регион (часовой пояс):');
      await ctx.editMessageText(text, { reply_markup: getTimezoneKeyboard() });
      await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^tz_(.+)$/, async (ctx) => {
      const timezone = ctx.match[1]; // например 'Europe/Moscow'
      
      await prisma.user.update({
          where: { id: ctx.dbUser!.id },
          data: { timezone }
      });

      const savedText = await getMessage('settings_saved', '✅ Настройки сохранены!');
      
      await ctx.editMessageText(`${savedText}\nВаш часовой пояс: ${timezone}`, {
          reply_markup: getSettingsKeyboard()
      });
      await ctx.answerCallbackQuery();
  });

  // Кнопка "Назад" в настройках
  bot.callbackQuery('settings_back', async (ctx) => {
      ctx.session.step = undefined;
      const text = await getMessage('settings_menu_title', '⚙️ Настройки');
      await ctx.editMessageText(text, { reply_markup: getSettingsKeyboard() });
      await ctx.answerCallbackQuery();
  });
}
