import { Bot, InlineKeyboard } from 'grammy';
import { PrismaClient } from '@prisma/client';
import type { BotContext } from '../types';
import { getMainMenuKeyboard, getSubscriptionKeyboard, getContinuePathKeyboard, getRemindLaterTrialKeyboard } from '../keyboards';
import { getMessage } from '../services/messages';

const prisma = new PrismaClient();

export function setupSubscriptionHandlers(bot: Bot<BotContext>) {
  
  // Кнопка "Продолжить путь" (из сообщения о конце триала) или "Подписка" из меню
  // Используем callbackQuery, так как в меню теперь callback кнопки
  bot.callbackQuery(['menu_subscription', 'sub_activate'], async (ctx) => {
      const text = 'Выберите подходящий тариф:';
      
      // Показываем тарифы
      try {
          await ctx.editMessageText(text, { reply_markup: getSubscriptionKeyboard() });
      } catch (e) {
          await ctx.reply(text, { reply_markup: getSubscriptionKeyboard() });
      }
      await ctx.answerCallbackQuery();
  });

  // Обработка тарифов (интеграция Tribute)
  bot.callbackQuery(['sub_plan_week', 'sub_plan_month', 'sub_plan_80days'], async (ctx) => {
      const plan = ctx.callbackQuery.data;
      let amount = 0;
      let title = '';
      let description = '';

      // Цены в копейках (если Tribute требует) или рублях. Tribute обычно принимает amount в минимальных единицах валюты (копейки для RUB).
      // Уточним: Tribute API обычно работает с инвойсами Telegram Payments.
      // Bot API createInvoice принимает цены в копейках (RUB).
      // 159 RUB = 15900
      
      switch (plan) {
          case 'sub_plan_week': 
            amount = 15900; 
            title = 'Подписка на 1 неделю'; 
            description = 'Доступ ко всем функциям бота на 7 дней';
            break;
          case 'sub_plan_month': 
            amount = 39900; 
            title = 'Подписка на 1 месяц'; 
            description = 'Доступ ко всем функциям бота на 30 дней';
            break;
          case 'sub_plan_80days': 
            amount = 99900; 
            title = 'Подписка на 80 дней'; 
            description = 'Полный курс Трансерфинга (80 дней)';
            break;
      }

      const providerToken = process.env.PAYMENT_PROVIDER_TOKEN; // Токен от Tribute/Smart Glocal
      
      if (!providerToken) {
          await ctx.answerCallbackQuery('⚠️ Платежная система временно недоступна');
          console.error('PAYMENT_PROVIDER_TOKEN is missing');
          return;
      }

      await ctx.answerCallbackQuery();
      
      console.log(`Sending invoice: ${title} for ${amount}`);

      // Используем raw API для точной передачи параметров (избегаем ошибок парсинга)
      await bot.api.raw.sendInvoice({
          chat_id: ctx.chat!.id,
          title: title,
          description: description,
          payload: plan,
          provider_token: providerToken,
          currency: 'RUB',
          prices: JSON.stringify([{ label: title, amount: amount }])
      });
  });
  
  // Обработчик PreCheckoutQuery (обязательно для платежей)
  bot.on('pre_checkout_query', async (ctx) => {
      await ctx.answerPreCheckoutQuery(true);
  });

  // Обработчик успешного платежа
  bot.on('message:successful_payment', async (ctx) => {
      const payment = ctx.message.successful_payment;
      const payload = payment.invoice_payload; // sub_plan_week, etc.
      
      let daysToAdd = 0;
      switch (payload) {
          case 'sub_plan_week': daysToAdd = 7; break;
          case 'sub_plan_month': daysToAdd = 30; break;
          case 'sub_plan_80days': daysToAdd = 80; break;
      }

      const user = ctx.dbUser!;
      const currentExpiresAt = user.subscription?.expiresAt && user.subscription.expiresAt > new Date() 
          ? user.subscription.expiresAt 
          : new Date();

      const newExpiresAt = new Date(currentExpiresAt);
      newExpiresAt.setDate(newExpiresAt.getDate() + daysToAdd);

      await prisma.subscription.upsert({
          where: { userId: user.id },
          update: {
              isActive: true,
              expiresAt: newExpiresAt,
              updatedAt: new Date()
          },
          create: {
              userId: user.id,
              isActive: true,
              activatedAt: new Date(),
              expiresAt: newExpiresAt,
              trialDaysUsed: user.subscription?.trialDaysUsed || 0 // Сохраняем прогресс триала если был
          }
      });

      await ctx.reply(
          `✅ Оплата прошла успешно!\n\n` +
          `Ваша подписка продлена до ${newExpiresAt.toLocaleDateString('ru-RU')}.\n` +
          `Спасибо, что вы с нами!`,
          { reply_markup: getMainMenuKeyboard() }
      );
  });

  // Обработка "Напомнить позже" (из триала)
  bot.callbackQuery('trial_remind_later', async (ctx) => {
      // Ставим напоминание (как и раньше)
      const nextTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // +2 часа
      await prisma.user.update({
          where: { id: ctx.dbUser!.id },
          data: { nextMorningMessageAt: nextTime }
      });

      const text = await getMessage('trial_remind_later', 'Иногда решение приходит не сразу...');
      
      try {
          await ctx.editMessageText(text, { reply_markup: getRemindLaterTrialKeyboard() });
      } catch (e) {
          await ctx.reply(text, { reply_markup: getRemindLaterTrialKeyboard() });
      }
      await ctx.answerCallbackQuery();
  });

  // Обработка "Нет, спасибо"
  bot.callbackQuery('trial_no_thanks', async (ctx) => {
      const text = await getMessage('trial_no_thanks', 'Я уважаю твой выбор...');
      
      try {
          // Убираем клавиатуру или меняем текст
          await ctx.editMessageText(text, { reply_markup: undefined }); // Без кнопок, просто текст
      } catch (e) {
          await ctx.reply(text);
      }
      await ctx.answerCallbackQuery();
  });
}

