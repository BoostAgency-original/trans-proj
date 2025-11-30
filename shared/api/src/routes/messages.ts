import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Получить все сообщения
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    
    const messages = await prisma.botMessage.findMany({
      where: category ? { category: category as string } : undefined,
      orderBy: {
        key: 'asc'
      }
    });
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получить сообщение по ключу
router.get('/:key', async (req, res) => {
  try {
    const message = await prisma.botMessage.findUnique({
      where: { key: req.params.key }
    });
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    res.json(message);
  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создать или обновить сообщение
router.post('/', async (req, res) => {
  try {
    const { key, text, category, description } = req.body;
    
    const message = await prisma.botMessage.upsert({
      where: { key },
      update: { text, category, description },
      create: { key, text, category, description }
    });
    
    res.json(message);
  } catch (error) {
    console.error('Error creating/updating message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновить сообщение
router.put('/:key', async (req, res) => {
  try {
    const { text, category, description } = req.body;
    
    const message = await prisma.botMessage.update({
      where: { key: req.params.key },
      data: { text, category, description }
    });
    
    res.json(message);
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Удалить сообщение
router.delete('/:key', async (req, res) => {
  try {
    await prisma.botMessage.delete({
      where: { key: req.params.key }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as messageRoutes };

