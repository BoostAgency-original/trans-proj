import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Получить все принципы
router.get('/', async (req, res) => {
  try {
    const principles = await prisma.transurfingPrinciple.findMany({
      orderBy: {
        dayNumber: 'asc',
      },
    });
    res.json(principles);
  } catch (error) {
    console.error('Error fetching principles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получить один принцип
router.get('/:id', async (req, res) => {
  try {
    const principle = await prisma.transurfingPrinciple.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    
    if (!principle) {
      return res.status(404).json({ error: 'Principle not found' });
    }
    
    res.json(principle);
  } catch (error) {
    console.error('Error fetching principle:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создать принцип
router.post('/', async (req, res) => {
  try {
    const { title, declaration, description, task, imageUrl, dayNumber } = req.body;
    
    // Если dayNumber не передан, берем последний + 1
    let newDayNumber = dayNumber;
    if (!newDayNumber) {
      const lastPrinciple = await prisma.transurfingPrinciple.findFirst({
        orderBy: { dayNumber: 'desc' },
      });
      newDayNumber = (lastPrinciple?.dayNumber || 0) + 1;
    }

    const principle = await prisma.transurfingPrinciple.create({
      data: {
        title,
        declaration,
        description,
        task,
        imageUrl,
        dayNumber: newDayNumber,
      },
    });
    
    res.json(principle);
  } catch (error) {
    console.error('Error creating principle:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновить принцип
router.put('/:id', async (req, res) => {
  try {
    const { title, declaration, description, task, imageUrl, dayNumber } = req.body;
    const principle = await prisma.transurfingPrinciple.update({
      where: { id: parseInt(req.params.id) },
      data: {
        title,
        declaration,
        description,
        task,
        imageUrl,
        dayNumber,
      },
    });
    
    res.json(principle);
  } catch (error) {
    console.error('Error updating principle:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Удалить принцип
router.delete('/:id', async (req, res) => {
  try {
    await prisma.transurfingPrinciple.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting principle:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Изменить порядок (reorder)
router.post('/reorder', async (req, res) => {
  try {
    const { ids } = req.body; // Массив ID в новом порядке
    
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: 'ids must be an array' });
    }

    // Обновляем dayNumber для каждого принципа в транзакции
    await prisma.$transaction(
      ids.map((id, index) => 
        prisma.transurfingPrinciple.update({
          where: { id },
          data: { dayNumber: index + 1 },
        })
      )
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering principles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as principleRoutes };

