import dotenv from 'dotenv';
import path from 'path';

// Load .env from current directory (bot/)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
// Also try loading from parent directory if not found (in case running from root)
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import { Bot, session } from 'grammy';
import { PrismaClient } from '@prisma/client';
import { setupCommands } from './commands';
import { setupMenuHandlers } from './handlers/menu';
import { setupSettingsHandlers } from './handlers/settings';
import { setupSubscriptionHandlers } from './handlers/subscription';
import { setupDiaryHandlers } from './handlers/diary';
import { setupIntroductionHandlers } from './handlers/introduction';
import { setupActionHandlers } from './handlers/actions'; // Import actions
import { startScheduler } from './scheduler';
import type { BotContext, SessionData } from './types';

// dotenv config moved to top

const prisma = new PrismaClient();
const bot = new Bot<BotContext>(process.env.BOT_TOKEN!);

// Начальные данные сессии
function initial(): SessionData {
  return {
    data: {}
  };
}

// Подключаем сессии
bot.use(session({ initial }));

// Middleware для инициализации пользователя
bot.use(async (ctx, next) => {
  if (ctx.from) {
    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(ctx.from.id) },
      update: {
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
      },
      create: {
        telegramId: BigInt(ctx.from.id),
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        timezone: 'Europe/Moscow', // Устанавливаем дефолтную зону МСК
      },
      include: {
        subscription: true
      }
    });
    
    ctx.dbUser = user;
  }
  
  await next();
});

// Регистрируем обработчики
setupIntroductionHandlers(bot);
setupActionHandlers(bot); // Register actions
setupCommands(bot);
setupMenuHandlers(bot);
setupSettingsHandlers(bot);
setupSubscriptionHandlers(bot);
setupDiaryHandlers(bot);

// Обработка ошибок
bot.catch((err) => {
  console.error('Error in bot:', err);
});

// Запускаем бота
bot.start({
  onStart: async (botInfo) => {
    console.log(`✅ Бот @${botInfo.username} запущен!`);
    
    // Проверка токена платежей
    if (process.env.PAYMENT_PROVIDER_TOKEN) {
        console.log('💳 Payment token loaded:', process.env.PAYMENT_PROVIDER_TOKEN.substring(0, 10) + '...');
    } else {
        console.warn('⚠️ PAYMENT_PROVIDER_TOKEN is missing in .env!');
    }
    
    // Устанавливаем команды для кнопки Menu
    await bot.api.setMyCommands([
      { command: 'start', description: 'Начать/Перезапустить бота' },
      { command: 'menu', description: 'Открыть главное меню' },
      { command: 'help', description: 'Помощь' },
    ]);
    
    // Запускаем планировщик задач после запуска бота
    await startScheduler(bot);
  },
});

// Graceful shutdown
process.once('SIGINT', () => {
  bot.stop();
  prisma.$disconnect();
});
process.once('SIGTERM', () => {
  bot.stop();
  prisma.$disconnect();
});
