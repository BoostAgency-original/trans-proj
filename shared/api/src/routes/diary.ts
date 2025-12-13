import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Получить все записи дневника
router.get('/', async (req, res) => {
  try {
    const { userId, principle } = req.query;
    
    const entries = await prisma.diaryEntry.findMany({
      where: {
        userId: userId ? parseInt(userId as string) : undefined,
        dayNumber: principle ? parseInt(principle as string) : undefined
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    res.json(entries);
  } catch (error) {
    console.error('Error fetching diary entries:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получить статистику по дневнику
router.get('/stats', async (req, res) => {
  try {
    const totalEntries = await prisma.diaryEntry.count();
    const totalUsers = await prisma.user.count({
      where: {
        diaryEntries: {
          some: {}
        }
      }
    });
    
    res.json({
      totalEntries,
      totalUsers
    });
  } catch (error) {
    console.error('Error fetching diary stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as diaryRoutes };

