import { Router } from 'express';
import { PrismaClient, type Prisma } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const AUDIENCES = ['all', 'intro_not_completed', 'paid_active', 'no_paid_active'] as const;
type Audience = (typeof AUDIENCES)[number];

function isAudience(value: unknown): value is Audience {
  return typeof value === 'string' && (AUDIENCES as readonly string[]).includes(value);
}

function getAudienceWhere(audience: Audience, now: Date): Prisma.UserWhereInput {
  switch (audience) {
    case 'all':
      return {};
    case 'intro_not_completed':
      return { isIntroCompleted: false };
    case 'paid_active':
      return {
        subscription: {
          is: {
            isActive: true,
            expiresAt: { gt: now },
          },
        },
      };
    case 'no_paid_active':
      return {
        OR: [
          // нет подписки
          { subscription: { is: null } },
          // триал / без expiresAt
          { subscription: { is: { expiresAt: null } } },
          // истекла
          { subscription: { is: { expiresAt: { lte: now } } } },
          // выключена
          { subscription: { is: { isActive: false } } },
        ],
      };
  }
}

function isMissingBroadcastsTableError(error: unknown): boolean {
  const anyErr = error as any;
  return anyErr?.code === 'P2021' && String(anyErr?.meta?.table || '').includes('broadcasts');
}

// Превью по аудиториям (для админки)
router.get('/stats', async (_req, res) => {
  try {
    const now = new Date();
    const [all, introNotCompleted, paidActive, noPaidActive] = await Promise.all([
      prisma.user.count({ where: getAudienceWhere('all', now) }),
      prisma.user.count({ where: getAudienceWhere('intro_not_completed', now) }),
      prisma.user.count({ where: getAudienceWhere('paid_active', now) }),
      prisma.user.count({ where: getAudienceWhere('no_paid_active', now) }),
    ]);

    res.json({
      all,
      intro_not_completed: introNotCompleted,
      paid_active: paidActive,
      no_paid_active: noPaidActive,
      updatedAt: now.toISOString(),
    });
  } catch (error) {
    if (isMissingBroadcastsTableError(error)) {
      return res.status(503).json({
        error:
          'Таблица broadcasts отсутствует в БД. Примените миграции Prisma (shared/prisma) и перезапустите API.',
      });
    }
    console.error('Error fetching broadcast stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Список рассылок (последние)
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10) || 20, 100);
    const broadcasts = await prisma.broadcast.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json(broadcasts);
  } catch (error) {
    if (isMissingBroadcastsTableError(error)) {
      return res.status(503).json({
        error:
          'Таблица broadcasts отсутствует в БД. Примените миграции Prisma (shared/prisma) и перезапустите API.',
      });
    }
    console.error('Error fetching broadcasts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создать рассылку (бот обработает и отправит)
router.post('/', async (req, res) => {
  try {
    const { audience, text, parseMode } = req.body ?? {};

    if (!isAudience(audience)) {
      return res.status(400).json({ error: 'Invalid audience' });
    }
    if (typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const safeParseMode =
      parseMode === 'HTML' || parseMode === 'MarkdownV2' || parseMode === null || typeof parseMode === 'undefined'
        ? parseMode
        : null;

    const created = await prisma.broadcast.create({
      data: {
        audience,
        text: text.trim(),
        parseMode: safeParseMode ?? null,
        status: 'pending',
      },
    });

    res.json(created);
  } catch (error) {
    if (isMissingBroadcastsTableError(error)) {
      return res.status(503).json({
        error:
          'Таблица broadcasts отсутствует в БД. Примените миграции Prisma (shared/prisma) и перезапустите API.',
      });
    }
    console.error('Error creating broadcast:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Отменить рассылку
router.post('/:id/cancel', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const existing = await prisma.broadcast.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!['pending', 'running'].includes(existing.status)) {
      return res.status(400).json({ error: 'Cannot cancel in current status' });
    }

    const updated = await prisma.broadcast.update({
      where: { id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });
    res.json(updated);
  } catch (error) {
    if (isMissingBroadcastsTableError(error)) {
      return res.status(503).json({
        error:
          'Таблица broadcasts отсутствует в БД. Примените миграции Prisma (shared/prisma) и перезапустите API.',
      });
    }
    console.error('Error cancelling broadcast:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as broadcastRoutes };


