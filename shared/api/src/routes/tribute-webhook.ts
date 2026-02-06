import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Отправка сообщения через Telegram Bot API
async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    console.error('[Tribute Webhook] BOT_TOKEN not configured');
    return false;
  }

  try {
    const body: any = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    };
    if (replyMarkup) {
      body.reply_markup = JSON.stringify(replyMarkup);
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Tribute Webhook] Telegram API error:', errorText);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[Tribute Webhook] Error sending Telegram message:', error);
    return false;
  }
}

// Генерация ссылки на подарок
function buildGiftLink(token: string): { link?: string; startCmd: string } {
  const botUsername = process.env.BOT_USERNAME;
  const link = botUsername ? `https://t.me/${botUsername}?start=gift_${token}` : undefined;
  return { link, startCmd: `/start gift_${token}` };
}

// Реальная структура вебхука от Tribute
interface TributeWebhookPayload {
  subscription_name: string;
  subscription_id: number;
  period_id: number;
  period: string; // "onetime", "week", "month", etc.
  price: number;
  amount: number;
  currency: string;
  user_id: number; // Tribute internal user ID
  telegram_user_id: number; // Telegram ID пользователя!
  web_app_link: string;
  channel_id: number;
  channel_name: string;
  expires_at: string; // ISO date
  type: 'regular' | 'gift' | 'trial';
}

interface TributeWebhook {
  name: 'new_subscription' | 'subscription_canceled' | 'subscription_renewed';
  created_at: string;
  sent_at: string;
  payload: TributeWebhookPayload;
}

// Маппинг периодов Tribute на дни
function periodToDays(period: string, expiresAt?: string): number {
  // Если есть expires_at — вычисляем дни до него
  if (expiresAt) {
    const expires = new Date(expiresAt);
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    // Ограничиваем максимум 365 днями (если "onetime" = 100 лет)
    return Math.min(Math.max(diffDays, 1), 365);
  }
  
  // Fallback по названию периода
  switch (period.toLowerCase()) {
    case 'week': return 7;
    case 'month': return 30;
    case '3months': return 90;
    case 'year': return 365;
    case 'onetime': return 365; // Разовый = год
    default: return 30; // По умолчанию месяц
  }
}

// Проверка подписи HMAC-SHA256
function verifySignature(body: string, signature: string, apiKey: string): boolean {
  const hmac = crypto.createHmac('sha256', apiKey);
  hmac.update(body);
  const expectedSignature = hmac.digest('hex');
  
  // Безопасное сравнение для защиты от timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

// Активация/продление подписки пользователю
async function activateSubscription(telegramId: number, days: number, subscriptionName: string) {
  // Находим пользователя по telegram_id
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
    include: { subscription: true }
  });

  if (!user) {
    console.error(`[Tribute Webhook] User not found: telegramId=${telegramId}`);
    return { success: false, error: 'User not found' };
  }

  const now = new Date();
  
  // Если есть активная подписка — продлеваем от её окончания
  const currentExpiresAt = user.subscription?.expiresAt && user.subscription.expiresAt > now
    ? user.subscription.expiresAt
    : now;

  const newExpiresAt = new Date(currentExpiresAt);
  newExpiresAt.setDate(newExpiresAt.getDate() + days);

  // Обновляем подписку
  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {
      isActive: true,
      expiresAt: newExpiresAt,
      updatedAt: now
    },
    create: {
      userId: user.id,
      isActive: true,
      activatedAt: now,
      expiresAt: newExpiresAt,
      trialDaysUsed: user.subscription?.trialDaysUsed || 0
    }
  });

  console.log(`[Tribute Webhook] Subscription activated: user=${user.id}, telegramId=${telegramId}, days=${days}, expiresAt=${newExpiresAt.toISOString()}`);

  return { 
    success: true, 
    userId: user.id,
    expiresAt: newExpiresAt,
    subscriptionName
  };
}

// POST /api/tribute/webhook
router.post('/', async (req: Request, res: Response) => {
  const apiKey = process.env.TRIBUTE_API_KEY;
  
  if (!apiKey) {
    console.error('[Tribute Webhook] TRIBUTE_API_KEY not configured');
    return res.status(500).json({ success: false, error: 'Webhook not configured' });
  }

  // Получаем подпись из заголовка
  // Tribute может использовать разные заголовки, проверяем несколько вариантов
  const signature = req.headers['x-tribute-signature'] as string 
    || req.headers['x-signature'] as string
    || req.headers['signature'] as string;

  const rawBody = JSON.stringify(req.body);

  // Проверка подписи (если Tribute её присылает)
  if (signature && !verifySignature(rawBody, signature, apiKey)) {
    console.error('[Tribute Webhook] Invalid signature');
    return res.status(401).json({ success: false, error: 'Invalid signature' });
  }

  const webhook = req.body as TributeWebhook;
  
  console.log(`[Tribute Webhook] Received: ${webhook.name}`, JSON.stringify(webhook, null, 2));

  try {
    switch (webhook.name) {
      case 'new_subscription':
      case 'subscription_renewed': {
        const { telegram_user_id, period, expires_at, subscription_name } = webhook.payload;
        
        if (!telegram_user_id) {
          console.error('[Tribute Webhook] Missing telegram_user_id');
          return res.status(400).json({ success: false, error: 'Missing telegram_user_id' });
        }

        const days = periodToDays(period, expires_at);
        
        console.log(`[Tribute Webhook] Processing: telegram_user_id=${telegram_user_id}, period=${period}, days=${days}`);

        // Находим пользователя
        const user = await prisma.user.findUnique({
          where: { telegramId: BigInt(telegram_user_id) }
        });

        if (!user) {
          console.error(`[Tribute Webhook] User not found: telegramId=${telegram_user_id}`);
          return res.json({ success: true }); // 200 чтобы не ретраил
        }

        // Проверяем есть ли pending_tribute подарок от этого пользователя
        const pendingGift = await prisma.giftSubscription.findFirst({
          where: {
            createdByUserId: user.id,
            status: 'pending_tribute'
          },
          orderBy: { createdAt: 'desc' }
        });

        if (pendingGift) {
          // Это оплата подарка — отправляем ссылку
          console.log(`[Tribute Webhook] Found pending gift: ${pendingGift.token}`);

          await prisma.giftSubscription.update({
            where: { token: pendingGift.token },
            data: { status: 'paid', paidAt: new Date() }
          });

          const { link, startCmd } = buildGiftLink(pendingGift.token);
          const giftDuration = pendingGift.days === 7 ? '1 неделю' : 
                              pendingGift.days === 30 ? '1 месяц' : 
                              `${pendingGift.days} дней`;

          const message = 
            `🎁 <b>Подарок оплачен!</b>\n\n` +
            `Подписка на <b>${giftDuration}</b> готова к отправке.\n\n` +
            (link 
              ? `<b>Ссылка для друга:</b>\n<a href="${link}">${link}</a>\n\n`
              : `<b>Команда для друга:</b>\n<code>${startCmd}</code>\n\n`) +
            `Перешлите это сообщение другу или скопируйте ссылку.`;

          const keyboard = link ? {
            inline_keyboard: [
              [{ text: '📨 Поделиться', url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('🎁 Дарю тебе подписку!')}` }]
            ]
          } : undefined;

          await sendTelegramMessage(telegram_user_id, message, keyboard);
          console.log(`[Tribute Webhook] Gift link sent to user ${telegram_user_id}`);

          return res.json({ success: true });
        }

        // Обычная подписка — активируем
        const result = await activateSubscription(
          telegram_user_id,
          days,
          subscription_name
        );

        if (result.success) {
          // Отправляем подтверждение пользователю
          const message = 
            `✅ <b>Оплата через Tribute прошла успешно!</b>\n\n` +
            `Ваша подписка активирована до ${result.expiresAt?.toLocaleDateString('ru-RU')}.\n` +
            `Спасибо, что вы с нами!`;
          
          await sendTelegramMessage(telegram_user_id, message);
        } else {
          console.error('[Tribute Webhook] Failed to activate:', result.error);
        }

        return res.json({ success: true });
      }

      case 'subscription_canceled': {
        // При отмене подписки в Tribute мы НЕ отключаем подписку сразу
        // Пользователь может пользоваться до expiresAt
        console.log('[Tribute Webhook] Subscription canceled, no action needed (user keeps access until expiry)');
        return res.json({ success: true });
      }

      default:
        console.log(`[Tribute Webhook] Unknown event: ${webhook.name}`);
        return res.json({ success: true });
    }
  } catch (error) {
    console.error('[Tribute Webhook] Error processing:', error);
    // Возвращаем 200 чтобы избежать бесконечных ретраев
    return res.json({ success: false, error: 'Internal error' });
  }
});

// GET для проверки что endpoint работает
router.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Tribute webhook endpoint is ready' });
});

export const tributeWebhookRoutes = router;
