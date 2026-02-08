import { Router, Request, Response } from 'express';
import { createHash, createHmac } from 'crypto';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Верификация подписи Crypto Pay
// secret = SHA256(token), signature = HMAC-SHA256(secret, body)
function verifySignature(body: string, signature: string, token: string): boolean {
  try {
    const secret = createHash('sha256').update(token).digest();
    const hmac = createHmac('sha256', secret).update(body).digest('hex');
    return hmac === signature;
  } catch {
    return false;
  }
}

// Отправка сообщения через Telegram Bot API
async function sendTelegramMessage(chatId: number | string, text: string, replyMarkup?: any) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    console.error('[CryptoPay Webhook] BOT_TOKEN not configured');
    return false;
  }

  try {
    const body: any = { chat_id: chatId, text, parse_mode: 'HTML' };
    if (replyMarkup) body.reply_markup = JSON.stringify(replyMarkup);

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CryptoPay Webhook] Telegram API error:', errorText);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[CryptoPay Webhook] Error sending Telegram message:', error);
    return false;
  }
}

// Активация подписки
async function activateSubscription(userId: number, days: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });

  if (!user) {
    console.error(`[CryptoPay Webhook] User not found: id=${userId}`);
    return null;
  }

  const now = new Date();
  const currentExpiresAt =
    user.subscription?.expiresAt && user.subscription.expiresAt > now
      ? user.subscription.expiresAt
      : now;

  const newExpiresAt = new Date(currentExpiresAt);
  newExpiresAt.setDate(newExpiresAt.getDate() + days);

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: { isActive: true, expiresAt: newExpiresAt, updatedAt: now },
    create: {
      userId: user.id,
      isActive: true,
      activatedAt: now,
      expiresAt: newExpiresAt,
      trialDaysUsed: user.subscription?.trialDaysUsed || 0,
    },
  });

  // Если практика ещё не стартовала — запускаем
  if (user.isIntroCompleted && !user.introCompletedAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        introCompletedAt: now,
        currentPrincipleDay: 2,
        lastPrincipleSentAt: now,
      } as any,
    });
  }

  console.log(`[CryptoPay Webhook] Subscription activated: user=${userId}, days=${days}, expiresAt=${newExpiresAt.toISOString()}`);
  return { user, newExpiresAt };
}

// POST /api/crypto-pay/webhook
router.post('/', async (req: Request, res: Response) => {
  const token = process.env.CRYPTO_PAY_API_TOKEN;

  if (!token) {
    console.error('[CryptoPay Webhook] CRYPTO_PAY_API_TOKEN not configured');
    return res.status(500).json({ ok: false });
  }

  // Проверяем подпись
  const signature = req.headers['crypto-pay-api-signature'] as string;
  const rawBody = JSON.stringify(req.body);

  if (!signature || !verifySignature(rawBody, signature, token)) {
    console.error('[CryptoPay Webhook] Invalid signature');
    return res.status(401).json({ ok: false });
  }

  const { update_type, payload: invoice } = req.body;

  console.log(`[CryptoPay Webhook] Received: ${update_type}`, JSON.stringify(req.body, null, 2));

  if (update_type !== 'invoice_paid') {
    return res.json({ ok: true });
  }

  try {
    // Парсим наш payload из инвойса
    const payloadStr = invoice?.payload;
    if (!payloadStr) {
      console.error('[CryptoPay Webhook] No payload in invoice');
      return res.json({ ok: true });
    }

    const data = JSON.parse(payloadStr);
    // data = { type: "subscription"|"gift", userId, planId, days, telegramId, giftToken? }

    if (data.type === 'subscription') {
      const result = await activateSubscription(data.userId, data.days);

      if (result) {
        await sendTelegramMessage(
          data.telegramId,
          `✅ <b>Оплата криптой прошла успешно!</b>\n\n` +
          `Ваша подписка активирована до ${result.newExpiresAt.toLocaleDateString('ru-RU')}.\n` +
          `Спасибо, что вы с нами!`
        );
      }
    } else if (data.type === 'gift') {
      // Обновляем статус подарка
      const gift = await prisma.giftSubscription.findUnique({
        where: { token: data.giftToken },
      });

      if (!gift || gift.status !== 'created') {
        console.error('[CryptoPay Webhook] Gift not found or already processed:', data.giftToken);
        return res.json({ ok: true });
      }

      await prisma.giftSubscription.update({
        where: { token: data.giftToken },
        data: { status: 'paid', paidAt: new Date() },
      });

      // Генерируем ссылку на подарок
      const botUsername = process.env.BOT_USERNAME?.replace('@', '');
      const link = botUsername
        ? `https://t.me/${botUsername}?start=gift_${data.giftToken}`
        : null;
      const startCmd = `/start gift_${data.giftToken}`;

      const giftDuration =
        data.days === 7 ? '1 неделю' : data.days === 30 ? '1 месяц' : `${data.days} дней`;

      const message =
        `🎁 <b>Подарок оплачен!</b>\n\n` +
        `Подписка на <b>${giftDuration}</b> готова к отправке.\n\n` +
        (link
          ? `<b>Ссылка для друга:</b>\n<a href="${link}">${link}</a>\n\n`
          : `<b>Команда для друга:</b>\n<code>${startCmd}</code>\n\n`) +
        `Перешлите это сообщение другу или скопируйте ссылку.`;

      const keyboard = link
        ? {
            inline_keyboard: [
              [{ text: '📨 Поделиться', url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('🎁 Дарю тебе подписку!')}` }],
            ],
          }
        : undefined;

      await sendTelegramMessage(data.telegramId, message, keyboard);
      console.log(`[CryptoPay Webhook] Gift link sent to user ${data.telegramId}`);
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('[CryptoPay Webhook] Error processing:', error);
    return res.json({ ok: true }); // 200 чтобы не ретраил
  }
});

// GET для проверки
router.get('/', (req: Request, res: Response) => {
  res.json({ ok: true, message: 'Crypto Pay webhook endpoint is ready' });
});

export const cryptoPayWebhookRoutes = router;
