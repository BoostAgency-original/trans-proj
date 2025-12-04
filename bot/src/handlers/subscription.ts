import { Bot, InlineKeyboard } from 'grammy';
import { PrismaClient } from '@prisma/client';
import type { BotContext } from '../types';
import { getMainMenuKeyboard, getSubscriptionKeyboard, getRemindLaterTrialKeyboard, getBackToMenuKeyboard } from '../keyboards';
import { getMessage } from '../services/messages';

const prisma = new PrismaClient();

// Данные о тарифах
const PLANS = {
    sub_plan_week: {
        amount: 15900, // в копейках (159 руб)
        title: 'Подписка на 1 неделю',
        description: 'Доступ ко всем функциям бота на 7 дней',
        duration: '1 неделю',
        days: 7
    },
    sub_plan_month: {
        amount: 39900, // 399 руб
        title: 'Подписка на 1 месяц',
        description: 'Доступ ко всем функциям бота на 30 дней',
        duration: '1 месяц',
        days: 30
    },
    sub_plan_80days: {
        amount: 99900, // 999 руб
        title: 'Подписка на 80 дней',
        description: 'Полный курс Трансерфинга (80 дней)',
        duration: '80 дней',
        days: 80
    }
} as const;

type PlanId = keyof typeof PLANS;

export function setupSubscriptionHandlers(bot: Bot<BotContext>) {
  
  // Кнопка "Продолжить путь" (из сообщения о конце триала) или "Подписка" из меню
  bot.callbackQuery(['menu_subscription', 'sub_activate'], async (ctx) => {
      const text = 'Выберите подходящий тариф:';
      
      try {
          await ctx.editMessageText(text, { reply_markup: getSubscriptionKeyboard() });
      } catch (e) {
          await ctx.reply(text, { reply_markup: getSubscriptionKeyboard() });
      }
      await ctx.answerCallbackQuery();
  });

  // Шаг 1: Выбор тарифа → показываем подтверждение
  bot.callbackQuery(['sub_plan_week', 'sub_plan_month', 'sub_plan_80days'], async (ctx) => {
      const planId = ctx.callbackQuery.data as PlanId;
      const plan = PLANS[planId];

      const confirmText = 
          `Вы собираетесь купить подписку на использование сервиса на ${plan.duration}\n\n` +
          `Стоимость: ${plan.amount / 100} ₽`;

      const keyboard = new InlineKeyboard()
          .text('💳 Купить', `confirm_buy_${planId}`)
          .row()
          .text('« Назад', 'menu_subscription');

      try {
          await ctx.editMessageText(confirmText, { reply_markup: keyboard });
      } catch (e) {
          await ctx.reply(confirmText, { reply_markup: keyboard });
      }
      await ctx.answerCallbackQuery();
  });

  // Шаг 2: Подтверждение покупки → отправляем инвойс ЮКассы
  bot.callbackQuery(/^confirm_buy_(.+)$/, async (ctx) => {
      const planId = ctx.match[1] as PlanId;
      const plan = PLANS[planId];

      const providerToken = process.env.PAYMENT_PROVIDER_TOKEN;
      
      if (!providerToken) {
          await ctx.answerCallbackQuery('⚠️ Платежная система временно недоступна');
          console.error('PAYMENT_PROVIDER_TOKEN is missing');
          return;
      }

      await ctx.answerCallbackQuery();
      
      console.log(`Sending invoice: ${plan.title} for ${plan.amount} kopecks`);

      // Данные для чека (фискализация ЮKassa)
      // amount.value в рублях, vat_code=1 (без НДС), tax_system_code=2 (УСН доход)
      const providerData = JSON.stringify({
          receipt: {
              items: [
                  {
                      description: plan.title,
                      quantity: 1,
                      amount: {
                          value: (plan.amount / 100).toFixed(2), // в рублях
                          currency: 'RUB'
                      },
                      vat_code: 1, // без НДС
                      payment_mode: 'full_payment',
                      payment_subject: 'service' // услуга
                  }
              ],
              tax_system_code: 2 // УСН доход
          }
      });

      // Отправляем инвойс через Telegram Payments API (ЮКасса)
      try {
          await bot.api.sendInvoice(
              ctx.chat!.id,
              plan.title,
              plan.description,
              planId, // payload - для идентификации после оплаты
              'RUB',
              [{ label: plan.title, amount: plan.amount }],
              {
                  provider_token: providerToken,
                  need_email: true, // запрашиваем email для чека
                  send_email_to_provider: true, // отправляем email в ЮKassa
                  provider_data: providerData // данные для чека
              }
          );
      } catch (error) {
          console.error('Error sending invoice:', error);
          await ctx.reply('❌ Ошибка при создании платежа. Попробуйте позже.', {
              reply_markup: getBackToMenuKeyboard()
          });
      }
  });
  
  // Обработчик PreCheckoutQuery (обязательно для Telegram Payments)
  bot.on('pre_checkout_query', async (ctx) => {
      // Здесь можно добавить проверки (например, актуальность цены)
      // Для простоты просто подтверждаем
      await ctx.answerPreCheckoutQuery(true);
  });

  // Обработчик успешного платежа
  bot.on('message:successful_payment', async (ctx) => {
      const payment = ctx.message.successful_payment;
      const planId = payment.invoice_payload as PlanId;
      const plan = PLANS[planId];
      
      if (!plan) {
          console.error('Unknown plan in payment:', planId);
          return;
      }

      const user = ctx.dbUser!;
      const currentExpiresAt = user.subscription?.expiresAt && user.subscription.expiresAt > new Date() 
          ? user.subscription.expiresAt 
          : new Date();

      const newExpiresAt = new Date(currentExpiresAt);
      newExpiresAt.setDate(newExpiresAt.getDate() + plan.days);

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
              trialDaysUsed: user.subscription?.trialDaysUsed || 0
          }
      });

      await ctx.reply(
          `✅ Оплата прошла успешно!\n\n` +
          `Ваша подписка продлена до ${newExpiresAt.toLocaleDateString('ru-RU')}.\n` +
          `Спасибо, что вы с нами!`,
          { reply_markup: getMainMenuKeyboard() }
      );
  });

  // Обработка "Напомнить позже" (из триала) - напоминание через 2 дня
  bot.callbackQuery('trial_remind_later', async (ctx) => {
      const nextTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // +2 дня
      await prisma.user.update({
          where: { id: ctx.dbUser!.id },
          data: { subscriptionReminderAt: nextTime }
      });

      const text = await getMessage('trial_remind_later', 'Иногда решение приходит не сразу. Напомню тебе через 2 дня.');
      
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
          await ctx.editMessageText(text, { reply_markup: undefined });
      } catch (e) {
          await ctx.reply(text);
      }
      await ctx.answerCallbackQuery();
  });
}
