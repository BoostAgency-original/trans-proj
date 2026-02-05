import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Типы для вебхуков Tribute
interface TributeUser {
  id: number; // telegram_id
  username?: string;
  firstName?: string;
  lastName?: string;
}

interface TributeSubscription {
  id: number;
  name: string;
  period: number; // дней
  price: number; // в копейках
}

interface TributeWebhookPayload {
  id: number;
  user: TributeUser;
  type: 'regular' | 'gift' | 'trial';
  subscription: TributeSubscription;
  startsAt?: string;
  expiresAt?: string;
}

interface TributeWebhook {
  name: 'new_subscription' | 'subscription_canceled' | 'subscription_renewed';
  created_at: string;
  sent_at: string;
  payload: TributeWebhookPayload;
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
        const { user, subscription } = webhook.payload;
        
        if (!user?.id || !subscription?.period) {
          console.error('[Tribute Webhook] Missing user.id or subscription.period');
          return res.status(400).json({ success: false, error: 'Invalid payload' });
        }

        const result = await activateSubscription(
          user.id,
          subscription.period,
          subscription.name
        );

        if (!result.success) {
          // Возвращаем 200 чтобы Tribute не ретраил, но логируем ошибку
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
