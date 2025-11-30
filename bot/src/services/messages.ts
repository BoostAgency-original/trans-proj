import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Простой кэш в памяти, чтобы не дёргать БД слишком часто
// Время жизни кэша - 1 минута
const cache: Record<string, { text: string; expires: number }> = {};
const CACHE_TTL = 60 * 1000; // 1 минута

/**
 * Получает текст сообщения по ключу.
 * Если сообщение есть в базе, возвращает его текст.
 * Если нет, возвращает defaultText.
 */
export async function getMessage(key: string, defaultText: string): Promise<string> {
  const now = Date.now();

  // Проверяем кэш
  if (cache[key] && cache[key].expires > now) {
    return cache[key].text;
  }

  try {
    const message = await prisma.botMessage.findUnique({
      where: { key },
    });

    if (message) {
      // Сохраняем в кэш
      cache[key] = {
        text: message.text,
        expires: now + CACHE_TTL,
      };
      return message.text;
    }
  } catch (error) {
    console.error(`Error fetching message for key ${key}:`, error);
  }

  // Если не нашли или ошибка, возвращаем дефолт
  return defaultText;
}

