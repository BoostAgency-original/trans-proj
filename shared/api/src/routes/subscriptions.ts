import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Получить все подписки
router.get('/', async (req, res) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            telegramId: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    res.json(subscriptions);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновить подписку
router.put('/:userId', async (req, res) => {
  try {
    const { isActive, expiresAt } = req.body;
    
    const subscription = await prisma.subscription.upsert({
      where: { userId: parseInt(req.params.userId) },
      update: {
        isActive,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        activatedAt: isActive ? new Date() : undefined
      },
      create: {
        userId: parseInt(req.params.userId),
        isActive,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        activatedAt: isActive ? new Date() : undefined
      }
    });
    
    res.json(subscription);
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as subscriptionRoutes };

