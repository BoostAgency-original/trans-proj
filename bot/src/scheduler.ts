import { Bot } from 'grammy';
import { PrismaClient } from '@prisma/client';
import type { BotContext } from './types';
import { getMorningKeyboard, getEveningKeyboard, getTrialExpiredKeyboard, getSubscriptionKeyboard } from './keyboards';

const prisma = new PrismaClient();

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
        // Вычисляем номер дня
        // Первый принцип отправляется сразу после интро, поэтому утром следующего дня — день 2
        const daysSinceIntro = Math.floor(
          (now.getTime() - new Date(user.introCompletedAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        // daysSinceIntro = 0 (тот же день) -> не отправляем (уже получил 1-й принцип)
        // daysSinceIntro = 1 (следующий день) -> dayNumber = 2
        // daysSinceIntro = 2 -> dayNumber = 3 и т.д.
        
        if (daysSinceIntro === 0) {
          // Интро пройдено сегодня, первый принцип уже отправлен
          console.log(`User ${user.id}: Intro completed today, skipping morning message (already got day 1)`);
          continue;
        }
        
        const dayNumber = daysSinceIntro + 1;
        
        console.log(`User ${user.id}: Day number calculated: ${dayNumber} (days since intro: ${daysSinceIntro})`);

        // Получаем принцип
        const principle = await prisma.transurfingPrinciple.findUnique({
          where: { dayNumber }
        });

        if (!principle) {
          console.log(`⚠️ User ${user.id}: No principle found for day ${dayNumber}`);
          continue;
        }

        const name = user.name || user.firstName || 'друг';
        
        const message = `Доброе утро, ${name}!\n\n` +
          `*День ${dayNumber}. Принцип: ${principle.title}*\n\n` +
          `*Декларация:*\n\n>${principle.declaration.split('\n').join('\n>')}\n\n` +
          `*Пояснение:*\n${principle.description}\n\n` +
          `*Сегодня наблюдай:*\n\n${principle.task}`;

        // Проверка подписки
        const subscription = user.subscription;
        const trialDaysUsed = subscription?.trialDaysUsed || 0;
        const isActive = subscription?.isActive || false;
        
        if (dayNumber > 4 && !isActive) {
            console.log(`User ${user.id}: Subscription required (Day ${dayNumber})`);
            const subMsg = await getBotMessage('subscription_inactive') || `Ты проснулся в сновидении. Это уже сила.

Эти пять дней были не случайны. Ты почувствовал — что-то в тебе меняется.
Мир стал чуть мягче. Внутри — чуть яснее.
Это работает.

У трансформации есть ритм.
И она просит продолжения.

Если хочешь идти глубже — путь открыт.
Осталось 73 шага.

Открой практику полностью — и начни управлять реальностью осознанно.`;
            const finalMsg = subMsg.replace('{trial_days}', trialDaysUsed.toString());
            
             try {
              await bot.api.sendMessage(user.telegramId.toString(), finalMsg, {
                  reply_markup: getSubscriptionKeyboard()
              });
            } catch (e) {
                console.error(`Failed to send sub message to ${user.id}`, e);
            }
            continue;
        }

        try {
          await bot.api.sendMessage(user.telegramId.toString(), message, {
            reply_markup: getMorningKeyboard(),
            parse_mode: 'Markdown'
          });
          console.log(`✅ Sent morning principle (Day ${dayNumber}) to user ${user.id}`);
          
          // Сбрасываем напоминание, если сработало
          if (isReminderTime) {
            await prisma.user.update({
              where: { id: user.id },
              data: { nextMorningMessageAt: null }
            });
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

    const users = await prisma.user.findMany({
      include: {
        subscription: true,
      },
    });

    for (const user of users) {
      if (!user.isIntroCompleted) continue;

      const userTime = getCurrentTimeInTimezone(user.timezone);
      
      // Лог для отладки времени (показываем раз в минуту для каждого активного юзера)
      console.log(`👤 User ${user.id} (${user.timezone}): Local ${userTime} | Target ${eveningTime}`);

      if (userTime === eveningTime) {
        // Получаем номер дня
        const daysSinceIntro = user.introCompletedAt 
            ? Math.floor((Date.now() - new Date(user.introCompletedAt).getTime()) / (1000 * 60 * 60 * 24)) + 1
            : 0;

        // Проверка подписки
        const subscription = user.subscription;
        const isActive = subscription?.isActive || false;

        if (daysSinceIntro > 4 && !isActive) {
           // Если подписка неактивна и триал закончился
           // Вечером ничего не отправляем
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
          console.log(`✅ Sent evening message to user ${user.id}`);
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
        const users = await prisma.user.findMany({
            where: {
                isIntroCompleted: true,
                introCompletedAt: { not: null },
                subscription: {
                   isActive: true, // Ищем активные подписки, которые могут истечь (триалы считаются активными пока не истекут)
                   trialDaysUsed: { lt: 5 } // Где еще не зафиксировано полное прохождение триала (допустим 5 дней - порог)
                }
            },
            include: { subscription: true }
        });

        const now = new Date();

        for (const user of users) {
             const daysSinceIntro = Math.floor(
                (now.getTime() - new Date(user.introCompletedAt!).getTime()) / (1000 * 60 * 60 * 24)
             );
             
             // Если прошло 5 дней (день 0 - интро, дни 1-4 контент, день 5 - уже конец триала)
             // Или логика: интро (день 0) -> день 1 (1-й принцип) -> ... -> день 4 (4-й принцип)
             // На 5-й день утром пользователь должен получить сообщение о конце триала ВМЕСТО принципа.
             // В sendMorningMessages уже есть проверка: if (dayNumber > 4 && !isActive).
             // Но нам нужно отправить СПЕЦИАЛЬНОЕ сообщение именно в момент перехода.
             
             // Однако, пользователь говорит: "status is active, trial of the day is 0 out of 4, but at the same time it is activated on November 21, and now it is already November 29".
             // Проблема в том, что `trialDaysUsed` не обновляется сам по себе. Мы должны его инкрементировать или рассчитывать динамически.
             // В текущей реализации `trialDaysUsed` обновлялся бы только если бы мы его явно инкрементировали где-то.
             
             // В sendMorningMessages мы считаем `dayNumber` динамически от даты.
             // dayNumber = daysSinceIntro + 1;
             
             const dayNumber = daysSinceIntro + 1;
             
             // Если мы видим, что по факту времени прошло > 4 дней, но подписка все еще isActive (триальная), нужно её деактивировать и отправить письмо.
             // Но только если мы еще не отправляли это письмо (можно проверить по trialDaysUsed или добавить флаг).
             
             // Поправим логику: будем считать триал завершенным, если dayNumber > 4.
             // В этот момент мы должны:
             // 1. Снять isActive
             // 2. Отправить сообщение trial_expired
             
             // Проверяем, не истек ли уже триал
             if (dayNumber > 4 && user.subscription?.isActive) {
                 // Важно: если это не платная подписка. У нас пока нет разделения, считаем что isActive + trialDaysUsed < 5 = триал.
                 // Но если человек купил подписку, у него будет isActive = true.
                 // Как отличить? В модели Subscription есть expiresAt. Для триала он может быть null или установлен.
                 // Давайте пока считать, что если expiresAt == null и isActive == true и прошло > 4 дней с интро -> это просроченный триал.
                 // Или если expiresAt есть и он истек.
                 
                 // В текущей реализации сидов expiresAt не ставится для триала.
                 
                 const isPaidSubscription = user.subscription.expiresAt && user.subscription.expiresAt > now;
                 
                 if (!isPaidSubscription) {
                     console.log(`User ${user.id}: Trial expired (Day ${dayNumber}). Deactivating...`);
                     
                     // Деактивируем
                     await prisma.subscription.update({
                         where: { userId: user.id },
                         data: { isActive: false, trialDaysUsed: 5 } // Ставим 5, чтобы пометить как завершенный
                     });
                     
                     // Отправляем сообщение
                     const message = await getBotMessage('trial_expired') || 'Триал завершен.';
                     
                     try {
                         await bot.api.sendMessage(user.telegramId.toString(), message, {
                             reply_markup: getTrialExpiredKeyboard()
                         });
                         console.log(`✅ Sent trial expired message to user ${user.id}`);
                     } catch (e) {
                         console.error(`Failed to send trial expired msg to ${user.id}`, e);
                     }
                 }
             }
        }

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
