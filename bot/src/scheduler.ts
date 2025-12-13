import { Bot } from 'grammy';
import { PrismaClient } from '@prisma/client';
import type { BotContext } from './types';
import { getMorningKeyboard, getEveningKeyboard, getTrialExpiredKeyboard, getSubscriptionKeyboard } from './keyboards';

const prisma = new PrismaClient();

const TRIAL_DAYS = 7; // триал = первые 7 принципов/дней

// Функция для получения текущего времени в формате HH:mm в определенной timezone
function getCurrentTimeInTimezone(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(now);
  } catch (error) {
    console.error(`Error getting time for timezone ${timezone}:`, error);
    return '';
  }
}

// Функция для получения настройки из БД
async function getSetting(key: string): Promise<string | null> {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key },
    });
    return setting?.value || null;
  } catch (error) {
    console.error(`Error fetching setting ${key}:`, error);
    return null;
  }
}

// Функция для получения сообщения из БД
async function getBotMessage(key: string): Promise<string | null> {
  try {
    const message = await prisma.botMessage.findUnique({
      where: { key },
    });
    return message?.text || null;
  } catch (error) {
    console.error(`Error fetching bot message ${key}:`, error);
    return null;
  }
}

// Отправка утренних сообщений
async function sendMorningMessages(bot: Bot<BotContext>) {
  try {
    const morningTime = await getSetting('morning_time');
    if (!morningTime) {
        console.log('⚠️ Morning time not set in settings');
        return;
    }

    const users = await prisma.user.findMany({
      include: {
        subscription: true,
      },
    });

    const now = new Date();
    const formattedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    // Логируем один раз за цикл проверки, а не для каждого юзера, чтобы не спамить
    // console.log(`🔍 Checking morning messages. Server time: ${formattedTime}. Target: ${morningTime}. Users: ${users.length}`);

    for (const user of users) {
      // Если интро не пройдено или нет даты завершения, пропускаем
      if (!user.isIntroCompleted || !user.introCompletedAt) {
          // console.log(`User ${user.id}: Intro not completed`);
          continue;
      }

      const userTime = getCurrentTimeInTimezone(user.timezone);
      const isRegularTime = userTime === morningTime;
      
      // Проверка отложенного напоминания
      let isReminderTime = false;
      if (user.nextMorningMessageAt) {
        const reminderTime = new Date(user.nextMorningMessageAt);
        const diff = now.getTime() - reminderTime.getTime();
        // Если время напоминания наступило (с допуском 2 минуты)
        if (diff >= 0 && diff < 2 * 60 * 1000) {
          isReminderTime = true;
        }
      }
      
      if (isRegularTime) {
          console.log(`✅ User ${user.id}: Time match! User time: ${userTime}, Target: ${morningTime}`);
      }

      if (isRegularTime || isReminderTime) {
        // При напоминании отправляем тот же принцип (currentPrincipleDay - 1),
        // так как счётчик уже был инкрементирован после первой отправки
        let dayNumber = isReminderTime ? user.currentPrincipleDay - 1 : user.currentPrincipleDay;
        
        // Защита от случая когда dayNumber = 0 (если напоминание сработало для дня 1)
        if (dayNumber < 1) dayNumber = 1;
        
        console.log(`User ${user.id}: Principle day: ${dayNumber} (reminder: ${isReminderTime})`);

        // Проверка подписки (триал = первые 7 принципов)
        const subscription = user.subscription;
        const isPaidSubscription =
          !!(subscription?.isActive && subscription.expiresAt && subscription.expiresAt > now);
        const isTrialSubscription = !!(subscription?.isActive && !isPaidSubscription);
        const hasTrialAccess = isTrialSubscription && dayNumber <= TRIAL_DAYS;

        // Если принцип за пределами триала и нет активной платной подписки — показываем сообщение о подписке
        if (!isPaidSubscription && !hasTrialAccess) {
            console.log(`User ${user.id}: Subscription required (Day ${dayNumber})`);
            const subMsg = await getBotMessage('subscription_inactive') || `Ты проснулся в сновидении. Это уже сила.

Эти семь дней были не случайны. Ты почувствовал — что-то в тебе меняется.
Мир стал чуть мягче. Внутри — чуть яснее.
Это работает.

У трансформации есть ритм.
И она просит продолжения.

Если хочешь идти глубже — путь открыт.
Осталось 73 шага.

Открой практику полностью — и начни управлять реальностью осознанно.`;
            const used = subscription?.trialDaysUsed ?? 0;
            const finalMsg = subMsg
              .replace('{trial_days}', used.toString()) // обратная совместимость
              .replace('{trial_used}', used.toString())
              .replace('{trial_total}', TRIAL_DAYS.toString());
            
             try {
              await bot.api.sendMessage(user.telegramId.toString(), finalMsg, {
                  reply_markup: getSubscriptionKeyboard()
              });
            } catch (e) {
                console.error(`Failed to send sub message to ${user.id}`, e);
            }

            // На всякий случай “закрываем” триал в БД при первом выходе за лимит
            if (subscription?.isActive && !isPaidSubscription) {
              try {
                await prisma.subscription.update({
                  where: { userId: user.id },
                  data: { isActive: false, trialDaysUsed: Math.max(used, TRIAL_DAYS) },
                });
              } catch (e) {
                console.error(`Failed to deactivate trial for ${user.id}`, e);
              }
            }
            continue;
        }

        // Получаем принцип
        let principle = await prisma.transurfingPrinciple.findUnique({
          where: { dayNumber }
        });

        // Если принцип не найден (закончились) — начинаем сначала
        if (!principle) {
          console.log(`User ${user.id}: No principle for day ${dayNumber}, cycling back to day 1`);
          dayNumber = 1;
          principle = await prisma.transurfingPrinciple.findUnique({
            where: { dayNumber: 1 }
          });
          
          if (!principle) {
            console.log(`⚠️ User ${user.id}: No principles in database at all!`);
            continue;
          }
        }

        const name = user.name || user.firstName || 'друг';
        
        const message = `Доброе утро, ${name}!\n\n` +
          `<b>День ${dayNumber}. Принцип: ${principle.title}</b>\n\n` +
          `<b>Декларация:</b>\n\n<blockquote>${principle.declaration}</blockquote>\n\n` +
          `<b>Пояснение:</b>\n${principle.description}\n\n` +
          `<b>Сегодня наблюдай:</b>\n\n${principle.task}`;

        try {
          await bot.api.sendMessage(user.telegramId.toString(), message, {
            reply_markup: getMorningKeyboard(),
            parse_mode: 'HTML'
          });
          console.log(`✅ Sent morning principle (Day ${dayNumber}) to user ${user.id}${isReminderTime ? ' (reminder)' : ''}`);
          
          // При напоминании только сбрасываем nextMorningMessageAt, не инкрементируем счётчик
          if (isReminderTime) {
            await prisma.user.update({
              where: { id: user.id },
              data: { nextMorningMessageAt: null }
            });
          } else {
            // Инкрементируем номер принципа для следующего раза (только при обычной отправке)
            const totalPrinciples = await prisma.transurfingPrinciple.count();
            const nextDay = dayNumber >= totalPrinciples ? 1 : dayNumber + 1;
            
            await prisma.user.update({
              where: { id: user.id },
              data: { currentPrincipleDay: nextDay }
            });
            
            // Обновляем trialDaysUsed (сколько триальных принципов получил, макс 7)
            if (subscription && dayNumber <= TRIAL_DAYS) {
              await prisma.subscription.update({
                where: { userId: user.id },
                data: { trialDaysUsed: dayNumber }
              });
            }
          }
        } catch (error) {
          console.error(`❌ Failed to send morning message to user ${user.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error in sendMorningMessages:', error);
  }
}

// Отправка вечерних сообщений
async function sendEveningMessages(bot: Bot<BotContext>) {
  try {
    const eveningTime = await getSetting('evening_time');
    if (!eveningTime) return;

    const now = new Date();

    const users = await prisma.user.findMany({
      include: {
        subscription: true,
      },
    });

    for (const user of users) {
      if (!user.isIntroCompleted) continue;

      const userTime = getCurrentTimeInTimezone(user.timezone);
      const isRegularTime = userTime === eveningTime;
      
      // Проверка отложенного напоминания
      let isReminderTime = false;
      if (user.nextEveningMessageAt) {
        const reminderTime = new Date(user.nextEveningMessageAt);
        const diff = now.getTime() - reminderTime.getTime();
        // Если время напоминания наступило (с допуском 2 минуты)
        if (diff >= 0 && diff < 2 * 60 * 1000) {
          isReminderTime = true;
        }
      }

      if (isRegularTime || isReminderTime) {
        // Проверка подписки (триал = первые 7 принципов)
        const subscription = user.subscription;
        const isActive = subscription?.isActive || false;

        // Если триал уже закончился (следующий принцип > 7) и подписка неактивна — вечером не отправляем
        if (user.currentPrincipleDay > TRIAL_DAYS && !isActive) {
           continue;
        }
        
        let messageText = await getBotMessage('evening_reflection');
        if (!messageText) messageText = 'Как прошел твой день?';

        // Подставляем имя
        const name = user.name || user.firstName || 'друг';
        messageText = messageText.replace('{name}', name);

        try {
          await bot.api.sendMessage(user.telegramId.toString(), messageText, {
              reply_markup: getEveningKeyboard()
          });
          console.log(`✅ Sent evening message to user ${user.id}${isReminderTime ? ' (reminder)' : ''}`);
          
          // Сбрасываем напоминание, если сработало
          if (isReminderTime) {
            await prisma.user.update({
              where: { id: user.id },
              data: { nextEveningMessageAt: null }
            });
          }
        } catch (error) {
          console.error(`❌ Failed to send evening message to user ${user.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error in sendEveningMessages:', error);
  }
}

// Функция для отправки напоминаний о подписке (через 2 дня после "Напомнить позже")
async function sendSubscriptionReminders(bot: Bot<BotContext>) {
    try {
        const now = new Date();
        
        // Ищем пользователей с установленным временем напоминания о подписке, которое уже наступило
        const users = await prisma.user.findMany({
            where: {
                subscriptionReminderAt: {
                    lte: now // Время напоминания <= текущее время
                },
                subscription: {
                    isActive: false // Подписка неактивна (триал истёк)
                }
            },
            include: { subscription: true }
        });

        for (const user of users) {
            const message = await getBotMessage('subscription_reminder') || 
                'Привет! Прошло 2 дня. Готов продолжить путь трансформации?\n\nВыбери подходящий тариф:';
            
            try {
                await bot.api.sendMessage(user.telegramId.toString(), message, {
                    reply_markup: getSubscriptionKeyboard()
                });
                console.log(`✅ Sent subscription reminder to user ${user.id}`);
                
                // Сбрасываем время напоминания
                await prisma.user.update({
                    where: { id: user.id },
                    data: { subscriptionReminderAt: null }
                });
            } catch (e) {
                console.error(`Failed to send subscription reminder to ${user.id}`, e);
            }
        }
    } catch (e) {
        console.error('Error in sendSubscriptionReminders:', e);
    }
}

// Функция для проверки окончания триала
async function checkTrialExpiration(bot: Bot<BotContext>) {
    try {
        // Легаси-функция оставлена намеренно.
        // Деактивация триала выполняется в sendMorningMessages при первом выходе за лимит.
        void bot;
    } catch (e) {
        console.error('Error in checkTrialExpiration:', e);
    }
}

// Запуск планировщика
export async function startScheduler(bot: Bot<BotContext>) {
  console.log('📅 Запуск планировщика задач...');
  
  // Запускаем проверку триалов сразу при старте (чтобы починить текущие)
  checkTrialExpiration(bot);

  // Проверяем каждую минуту
  setInterval(async () => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // console.log(`⏰ Проверка времени: ${currentTime}`);
    
    // Запускаем проверку триалов раз в час
    if (now.getMinutes() === 0) {
        await checkTrialExpiration(bot);
    }
    
    // Проверяем напоминания о подписке каждые 10 минут
    if (now.getMinutes() % 10 === 0) {
        await sendSubscriptionReminders(bot);
    }

    await sendMorningMessages(bot);
    await sendEveningMessages(bot);

  }, 60000); // Каждую минуту

  console.log('✅ Планировщик задач запущен');
}
