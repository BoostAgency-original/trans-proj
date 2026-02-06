import { Bot, InlineKeyboard } from 'grammy';
import { PrismaClient } from '@prisma/client';
import type { BotContext } from '../types';
import { getMainMenuKeyboard, getSubscriptionKeyboard, getRemindLaterTrialKeyboard, getBackToMenuKeyboard, getMorningKeyboard, getPaymentMethodKeyboard, getGiftPaymentMethodKeyboard, getPromoPaymentMethodKeyboard, getTributeGiftLinkKeyboard } from '../keyboards';
import { getMessage } from '../services/messages';

const prisma = new PrismaClient();

const PAYMENTS_DISABLED = process.env.DISABLE_PAYMENTS === 'true';

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildGiftLink(token: string): { link?: string; startCmd: string } {
  const botUsername = process.env.BOT_USERNAME;
  const link = botUsername ? `https://t.me/${botUsername}?start=gift_${token}` : undefined;
  return { link, startCmd: `/start gift_${token}` };
}

function buildGiftShareReplyMarkup(opts: {
  shareText: string;
  link?: string;
  token: string;
}) {
  // Надёжный "шаринг" без inline-mode: Telegram открывает окно отправки в чат с предзаполненным текстом
  // https://core.telegram.org/widgets/share
  const shareUrl =
    `https://t.me/share/url?` +
    `url=${encodeURIComponent(opts.link ?? '')}` +
    `&text=${encodeURIComponent(opts.shareText)}`;

  const keyboard: any = {
    inline_keyboard: [[{ text: '📨 Отправить другу', url: shareUrl }]],
  };

  if (opts.link) {
    keyboard.inline_keyboard.push([{ text: '🔗 Открыть ссылку', url: opts.link }]);
  } else {
    keyboard.inline_keyboard.push([{ text: '📋 Показать команду', callback_data: `gift_cmd_${opts.token}` }]);
  }

  keyboard.inline_keyboard.push([{ text: '🚪 В меню', callback_data: 'menu_main' }]);
  return keyboard;
}

async function sendGiftCardToBuyer(ctx: BotContext, opts: { token: string; plan: (typeof PLANS)[PlanId]; isTest: boolean }) {
  const { link, startCmd } = buildGiftLink(opts.token);

  const defaultCard =
    `🎁 <b>Подарок: подписка на {duration}</b>\n\n` +
    `Это небольшой «сдвиг реальности» — знак заботы без лишней важности.\n\n` +
    `<b>Как активировать</b>:\n` +
    `1) Открой: <a href="{link}">активировать подарок</a>\n` +
    `2) Или отправь боту: <code>{start_cmd}</code>\n\n` +
    `<i>Подарок одноразовый — после активации ссылка перестанет работать.</i>`;

  const defaultShare =
    `🎁 Подарок: подписка на {duration}\n\n` +
    `Нажми «Старт» по ссылке, чтобы активировать:\n{link}\n\n` +
    `Если ссылка не открывается — отправь боту:\n{start_cmd}\n\n` +
    `Подарок одноразовый.`;

  const cardTemplate = await getMessage('gift_card', defaultCard);
  const shareTemplate = await getMessage('gift_share_text', defaultShare);

  const safeDuration = escapeHtml(opts.plan.duration);
  const safeLink = link ? escapeHtml(link) : '';
  const safeStartCmd = escapeHtml(startCmd);

  const cardHtml = cardTemplate
    .replaceAll('{duration}', safeDuration)
    .replaceAll('{days}', String(opts.plan.days))
    .replaceAll('{link}', safeLink || safeStartCmd)
    .replaceAll('{start_cmd}', safeStartCmd);

  const shareText = shareTemplate
    .replaceAll('{duration}', opts.plan.duration)
    .replaceAll('{days}', String(opts.plan.days))
    .replaceAll('{link}', link ?? startCmd)
    .replaceAll('{start_cmd}', startCmd);

  const header = opts.isTest ? '🧪 Тестовый режим: подарок создан без оплаты.\n\n' : '✅ Подарок готов.\n\n';
  const textToSend = header + cardHtml;

  await ctx.reply(textToSend, {
    parse_mode: 'HTML',
    reply_markup: buildGiftShareReplyMarkup({ shareText, link, token: opts.token }),
  });
}

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

async function sendInvoiceWithReceipt(
  bot: Bot<BotContext>,
  chatId: number,
  providerToken: string,
  title: string,
  description: string,
  payload: string,
  amountKopecks: number
) {
  const providerData = JSON.stringify({
    receipt: {
      items: [
        {
          description: title,
          quantity: 1,
          amount: {
            value: (amountKopecks / 100).toFixed(2),
            currency: 'RUB',
          },
          vat_code: 1,
          payment_mode: 'full_payment',
          payment_subject: 'service',
        },
      ],
      tax_system_code: 2,
    },
  });

  await bot.api.sendInvoice(
    chatId,
    title,
    description,
    payload,
    'RUB',
    [{ label: title, amount: amountKopecks }],
    {
      provider_token: providerToken,
      need_email: true,
      send_email_to_provider: true,
      provider_data: providerData,
    }
  );
}

async function sendFirstPrinciple(ctx: BotContext) {
  const principle = await prisma.transurfingPrinciple.findUnique({ where: { dayNumber: 1 } });
  if (!principle) return;

  const name = ctx.dbUser?.name || ctx.dbUser?.firstName || 'друг';
  const message =
    `${name}, поздравляю! Ты начал свой путь.\n\n` +
    `<b>День 1. Принцип: ${principle.title}</b>\n\n` +
    `<b>Декларация:</b>\n\n<blockquote>${principle.declaration}</blockquote>\n\n` +
    `<b>Пояснение:</b>\n${principle.description}\n\n` +
    `<b>Сегодня наблюдай:</b>\n\n${principle.task}`;

  await ctx.reply(message, { reply_markup: getMorningKeyboard(), parse_mode: 'HTML' });
}

export function setupSubscriptionHandlers(bot: Bot<BotContext>) {
  // Показать /start-команду для подарка (если BOT_USERNAME не задан)
  bot.callbackQuery(/^gift_cmd_(.+)$/, async (ctx) => {
    const token = ctx.match[1];
    await ctx.answerCallbackQuery();
    await ctx.reply(`Команда для друга:\n<code>/start gift_${escapeHtml(token)}</code>`, { parse_mode: 'HTML' });
  });
  
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

  // Шаг 1: Выбор тарифа → показываем выбор способа оплаты
  bot.callbackQuery(['sub_plan_week', 'sub_plan_month', 'sub_plan_80days'], async (ctx) => {
      const planId = ctx.callbackQuery.data as PlanId;
      const plan = PLANS[planId];

      const confirmText = 
          `Вы собираетесь купить подписку на использование сервиса на ${plan.duration}\n\n` +
          `Стоимость: ${plan.amount / 100} ₽\n\n` +
          `Выберите способ оплаты:`;

      try {
          await ctx.editMessageText(confirmText, { reply_markup: getPaymentMethodKeyboard(planId) });
      } catch (e) {
          await ctx.reply(confirmText, { reply_markup: getPaymentMethodKeyboard(planId) });
      }
      await ctx.answerCallbackQuery();
  });

  // Шаг 2: Подтверждение покупки → отправляем инвойс ЮКассы
  bot.callbackQuery(/^confirm_buy_(.+)$/, async (ctx) => {
      const planId = ctx.match[1] as PlanId;
      const plan = PLANS[planId];

      // Локальный тестовый режим: без реальной оплаты
      if (PAYMENTS_DISABLED) {
          await ctx.answerCallbackQuery();
          const user = ctx.dbUser!;
          const now = new Date();
          const currentExpiresAt =
            user.subscription?.expiresAt && user.subscription.expiresAt > now
              ? user.subscription.expiresAt
              : now;
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
              `🧪 Тестовый режим: подписка выдана без оплаты.\n\n` +
              `Ваша подписка продлена до ${newExpiresAt.toLocaleDateString('ru-RU')}.`,
              { reply_markup: getMainMenuKeyboard() }
          );

          // Если практика ещё не стартовала — стартуем и отправим 1-й принцип
          if (user.isIntroCompleted && !user.introCompletedAt) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                introCompletedAt: now,
                currentPrincipleDay: 2,
                lastPrincipleSentAt: now,
              } as any,
            });
            await sendFirstPrinciple(ctx);
          }
          return;
      }

      const providerToken = process.env.PAYMENT_PROVIDER_TOKEN;
      
      if (!providerToken) {
          await ctx.answerCallbackQuery('⚠️ Платежная система временно недоступна');
          console.error('PAYMENT_PROVIDER_TOKEN is missing');
          return;
      }

      await ctx.answerCallbackQuery();
      
      console.log(`Sending invoice: ${plan.title} for ${plan.amount} kopecks`);

      // Отправляем инвойс через Telegram Payments API (ЮКасса)
      try {
          await sendInvoiceWithReceipt(
            bot,
              ctx.chat!.id,
            providerToken,
              plan.title,
              plan.description,
            planId,
            plan.amount
          );
      } catch (error) {
          console.error('Error sending invoice:', error);
          await ctx.reply('❌ Ошибка при создании платежа. Попробуйте позже.', {
              reply_markup: getBackToMenuKeyboard()
          });
      }
  });

  // Промо-оплата до старта триала (скидка только тут)
  bot.callbackQuery(['promo_buy_month_299', 'promo_buy_80days_799'], async (ctx) => {
    const providerToken = process.env.PAYMENT_PROVIDER_TOKEN;
    if (!providerToken) {
      if (!PAYMENTS_DISABLED) {
        await ctx.answerCallbackQuery('⚠️ Платежная система временно недоступна');
        console.error('PAYMENT_PROVIDER_TOKEN is missing');
        return;
      }
    }

    const user = ctx.dbUser!;
    // Скидка доступна только до старта практики (introCompletedAt == null)
    if (user.introCompletedAt) {
      await ctx.answerCallbackQuery('Акция доступна только до старта пробного периода');
      return;
    }

    const isMonth = ctx.callbackQuery.data === 'promo_buy_month_299';
    const planId: PlanId = isMonth ? 'sub_plan_month' : 'sub_plan_80days';
    const plan = PLANS[planId];
    const promoAmount = isMonth ? 29900 : 79900;
    const title = isMonth ? `${plan.title} (акция)` : `${plan.title} (акция)`;
    const description = isMonth
      ? 'Скидка доступна до старта пробного периода'
      : 'Скидка доступна до старта пробного периода';

    await ctx.answerCallbackQuery();
    try {
      // Тестовый режим: выдаём подписку без оплаты
      if (PAYMENTS_DISABLED) {
        const now = new Date();
        const currentExpiresAt =
          user.subscription?.expiresAt && user.subscription.expiresAt > now
            ? user.subscription.expiresAt
            : now;
        const newExpiresAt = new Date(currentExpiresAt);
        newExpiresAt.setDate(newExpiresAt.getDate() + plan.days);

        await prisma.subscription.upsert({
          where: { userId: user.id },
          update: {
            isActive: true,
            expiresAt: newExpiresAt,
            updatedAt: new Date(),
          },
          create: {
            userId: user.id,
            isActive: true,
            activatedAt: new Date(),
            expiresAt: newExpiresAt,
            trialDaysUsed: user.subscription?.trialDaysUsed || 0,
          },
        });

        await ctx.reply(
          `🧪 Тестовый режим: подписка выдана без оплаты.\n\n` +
            `Ваша подписка продлена до ${newExpiresAt.toLocaleDateString('ru-RU')}.`,
          { reply_markup: getMainMenuKeyboard() }
        );

        if (user.isIntroCompleted && !user.introCompletedAt) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              introCompletedAt: now,
              currentPrincipleDay: 2,
              lastPrincipleSentAt: now,
            } as any,
          });
          await sendFirstPrinciple(ctx);
        }
        return;
      }

      await sendInvoiceWithReceipt(
        bot,
        ctx.chat!.id,
        providerToken!,
        title,
        description,
        planId, // payload оставляем обычным, скидка действует только в этом сценарии
        promoAmount
      );
    } catch (error) {
      console.error('Error sending promo invoice:', error);
      await ctx.reply('❌ Ошибка при создании платежа. Попробуйте позже.', {
        reply_markup: getBackToMenuKeyboard(),
      });
    }
  });
  
  // Подарок подписки: подтверждение и выбор способа оплаты
  bot.callbackQuery(/^gift_plan_(.+)$/, async (ctx) => {
    const planId = ctx.match[1] as PlanId;
    const plan = PLANS[planId];
    if (!plan) {
      await ctx.answerCallbackQuery('Неизвестный тариф');
      return;
    }

    const confirmText =
      `🎁 Подарить подписку\n\n` +
      `Тариф: ${plan.duration}\n` +
      `Стоимость: ${plan.amount / 100} ₽\n\n` +
      `После оплаты я пришлю «подарочную открытку» — её можно переслать другу.\n\n` +
      `Выберите способ оплаты:`;

    try {
      await ctx.editMessageText(confirmText, { reply_markup: getGiftPaymentMethodKeyboard(planId) });
    } catch (e) {
      await ctx.reply(confirmText, { reply_markup: getGiftPaymentMethodKeyboard(planId) });
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^confirm_gift_(.+)$/, async (ctx) => {
    const planId = ctx.match[1] as PlanId;
    const plan = PLANS[planId];
    if (!plan) {
      await ctx.answerCallbackQuery('Неизвестный тариф');
      return;
    }

    const providerToken = process.env.PAYMENT_PROVIDER_TOKEN;
    if (!providerToken && !PAYMENTS_DISABLED) {
      await ctx.answerCallbackQuery('⚠️ Платежная система временно недоступна');
      console.error('PAYMENT_PROVIDER_TOKEN is missing');
      return;
    }

    const gift = await prisma.giftSubscription.create({
      data: {
        status: 'created',
        planId,
        days: plan.days,
        amount: plan.amount,
        currency: 'RUB',
        createdByUserId: ctx.dbUser!.id,
      },
    });

    await ctx.answerCallbackQuery();

    try {
      // Тестовый режим: считаем подарок сразу оплаченным и отдаём ссылку
      if (PAYMENTS_DISABLED) {
        await prisma.giftSubscription.update({
          where: { token: gift.token },
          data: { status: 'paid', paidAt: new Date() },
        });

        await sendGiftCardToBuyer(ctx, { token: gift.token, plan, isTest: true });
        return;
      }

      await sendInvoiceWithReceipt(
        bot,
        ctx.chat!.id,
        providerToken!,
        `Подарок: ${plan.title}`,
        `Подарочная подписка на ${plan.duration}`,
        `gift:${gift.token}`,
        plan.amount
      );
    } catch (error) {
      console.error('Error sending gift invoice:', error);
      await ctx.reply('❌ Ошибка при создании платежа. Попробуйте позже.', {
        reply_markup: getBackToMenuKeyboard(),
          });
      }
  });

  // Подарок через Tribute: создаём GiftSubscription и показываем ссылку
  bot.callbackQuery(/^tribute_gift_(.+)$/, async (ctx) => {
    const planId = ctx.match[1] as PlanId;
    const plan = PLANS[planId];
    if (!plan) {
      await ctx.answerCallbackQuery('Неизвестный тариф');
      return;
    }

    // Создаём подарок со статусом pending_tribute
    const gift = await prisma.giftSubscription.create({
      data: {
        status: 'pending_tribute',
        planId,
        days: plan.days,
        amount: plan.amount,
        currency: 'RUB',
        createdByUserId: ctx.dbUser!.id,
      },
    });

    await ctx.answerCallbackQuery();

    await ctx.reply(
      `🎁 Подарок создан!\n\n` +
      `Тариф: ${plan.duration}\n\n` +
      `Перейдите в Tribute для оплаты. После оплаты я автоматически пришлю вам ссылку-подарок.`,
      { reply_markup: getTributeGiftLinkKeyboard() }
    );

    console.log(`[Gift Tribute] Created gift ${gift.token} for user ${ctx.dbUser!.id}, plan ${planId}`);
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
      const payload = payment.invoice_payload;

      // Gift purchase flow
      if (payload.startsWith('gift:')) {
        const token = payload.slice('gift:'.length);
        const gift = await prisma.giftSubscription.findUnique({ where: { token } });
        if (!gift) {
          console.error('Gift not found for token:', token);
          return;
        }

        if (gift.status !== 'created') {
          // уже обработан
          return;
        }

        await prisma.giftSubscription.update({
          where: { token },
          data: { status: 'paid', paidAt: new Date() },
        });

        const plan = PLANS[gift.planId as PlanId];
        if (!plan) {
          console.error('Unknown gift planId in db:', gift.planId);
          return;
        }
        await sendGiftCardToBuyer(ctx, { token, plan, isTest: false });
        return;
      }

      const planId = payload as PlanId;
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

      // Если пользователь купил подписку ДО старта триала — запускаем практику и отправляем 1-й принцип
      if (user.isIntroCompleted && !user.introCompletedAt) {
        const now = new Date();
        await prisma.user.update({
          where: { id: user.id },
          data: {
            introCompletedAt: now,
            currentPrincipleDay: 2,
            lastPrincipleSentAt: now,
          },
        });
        await sendFirstPrinciple(ctx);
      }
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
