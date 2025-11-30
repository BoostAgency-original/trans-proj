import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Получить все настройки
router.get('/', async (req, res) => {
  try {
    const settings = await prisma.settings.findMany({
      orderBy: {
        key: 'asc'
      }
    });
    
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получить настройку по ключу
router.get('/:key', async (req, res) => {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: req.params.key }
    });
    
    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    res.json(setting);
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создать или обновить настройку
router.post('/', async (req, res) => {
  try {
    const { key, value, description } = req.body;
    
    const setting = await prisma.settings.upsert({
      where: { key },
      update: { value, description },
      create: { key, value, description }
    });
    
    res.json(setting);
  } catch (error) {
    console.error('Error creating/updating setting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновить настройку
router.put('/:key', async (req, res) => {
  try {
    const { value, description } = req.body;
    
    const setting = await prisma.settings.update({
      where: { key: req.params.key },
      data: { value, description }
    });
    
    res.json(setting);
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Удалить настройку
router.delete('/:key', async (req, res) => {
  try {
    await prisma.settings.delete({
      where: { key: req.params.key }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting setting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as settingsRoutes };

