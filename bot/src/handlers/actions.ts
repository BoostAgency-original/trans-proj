import { Bot, InlineKeyboard } from 'grammy';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import type { BotContext } from '../types';
import { getBackToMenuKeyboard, getMainMenuKeyboard } from '../keyboards';
import { getMessage } from '../services/messages';
import { requireAccess } from '../services/access';

const prisma = new PrismaClient();

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export function setupActionHandlers(bot: Bot<BotContext>) {
  // 1. Записать в дневник (из утреннего сообщения)
  bot.callbackQuery('diary_add_auto', async (ctx) => {
    if (!await requireAccess(ctx)) {
        await ctx.answerCallbackQuery();
        return;
    }
    ctx.session.step = 'waiting_for_diary_note';
    ctx.session.data.diaryType = 'morning';
    
    const user = ctx.dbUser!;
    let dayNumber = 1;
    if (user.introCompletedAt) {
        dayNumber = Math.floor((Date.now() - user.introCompletedAt.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    ctx.session.data.currentDiaryDay = dayNumber;

    await ctx.reply(
      '📝 Напишите вашу утреннюю заметку.\n' +
      'Следующее сообщение будет сохранено.'
    );
    await ctx.answerCallbackQuery();
  });

  // 1.1 Записать в дневник (из вечернего сообщения)
  bot.callbackQuery('diary_add_evening', async (ctx) => {
    if (!await requireAccess(ctx)) {
        await ctx.answerCallbackQuery();
        return;
    }
    ctx.session.step = 'waiting_for_diary_note';
    ctx.session.data.diaryType = 'evening';
    
    const user = ctx.dbUser!;
    let dayNumber = 1;
    if (user.introCompletedAt) {
        dayNumber = Math.floor((Date.now() - user.introCompletedAt.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    ctx.session.data.currentDiaryDay = dayNumber;

    await ctx.reply(
      '📝 Напишите, как прошел ваш день.\n' +
      'Следующее сообщение будет сохранено в дневник.'
    );
    await ctx.answerCallbackQuery();
  });


  // 2. Напомнить позже (2 часа)
  bot.callbackQuery('remind_later_2h', async (ctx) => {
    const nextTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // +2 часа
    
    await prisma.user.update({
        where: { id: ctx.dbUser!.id },
        data: { nextMorningMessageAt: nextTime }
    });

    await ctx.reply('⏰ Хорошо, я напомню вам об этом через 2 часа.');
    await ctx.answerCallbackQuery();
  });

  // 3. Обсудить принцип с AI
  bot.callbackQuery('ai_discuss_principle', async (ctx) => {
    const user = ctx.dbUser!;
    
    let dayNumber = 1;
    if (user.introCompletedAt) {
        dayNumber = Math.floor((Date.now() - user.introCompletedAt.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    
    const principle = await prisma.transurfingPrinciple.findUnique({ where: { dayNumber } });
    
    if (!principle) {
        await ctx.answerCallbackQuery('Принцип не найден');
        return;
    }

    ctx.session.step = 'chatting_with_ai';
    ctx.session.data.aiContext = 'principle';
    ctx.session.data.currentPrinciple = principle;

    const keyboard = new InlineKeyboard()
        .text('❌ Закончить обсуждение', 'stop_ai_chat');

    await ctx.reply(
        `🧠 Режим обсуждения включен.\n\n` +
        `Я готов обсудить принцип "${principle.title}".\n` +
        `Задавайте свои вопросы или делитесь мыслями.`,
        { reply_markup: keyboard }
    );
    await ctx.answerCallbackQuery();
  });

  // 3.1 Обсудить день с AI
  bot.callbackQuery('ai_discuss_day', async (ctx) => {
    const user = ctx.dbUser!;
    
    // Определяем день
    let dayNumber = 1;
    if (user.introCompletedAt) {
        dayNumber = Math.floor((Date.now() - user.introCompletedAt.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    // Получаем принцип для контекста
    const principle = await prisma.transurfingPrinciple.findUnique({ where: { dayNumber } });

    ctx.session.step = 'chatting_with_ai';
    ctx.session.data.aiContext = 'day';
    ctx.session.data.currentPrinciple = principle; // Может быть null, если принципа нет, но не критично

    const keyboard = new InlineKeyboard()
        .text('❌ Закончить обсуждение', 'stop_ai_chat');

    await ctx.reply(
        `🌙 Режим обсуждения дня включен.\n\n` +
        `Расскажи, что произошло сегодня? Что удалось заметить?`,
        { reply_markup: keyboard }
    );
    await ctx.answerCallbackQuery();
  });

  // 4. Пропустить день
  bot.callbackQuery('skip_day', async (ctx) => {
      // Увеличиваем счетчик пропусков
      await prisma.user.update({
          where: { id: ctx.dbUser!.id },
          data: { skippedDays: { increment: 1 } }
      });

      // Отправляем сообщение
      const message = await getMessage('evening_skipped', 'Всё складывается правильно.');
      await ctx.reply(message, { reply_markup: getMainMenuKeyboard() });
      
      try {
          // Удаляем кнопки
          await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      } catch (e) {}

      await ctx.answerCallbackQuery();
  });


  // Выход из режима AI
  bot.callbackQuery('stop_ai_chat', async (ctx) => {
    const context = ctx.session.data.aiContext;
    
    ctx.session.step = undefined;
    ctx.session.data.currentPrinciple = undefined;
    ctx.session.data.aiContext = undefined;
    
    // Если это был вечерний чат, отправляем вдохновляющее сообщение
    if (context === 'day') {
        const message = await getMessage('evening_completed', 'Ты не просто читаешь — ты проживаешь...');
        await ctx.reply(message, {
            reply_markup: getMainMenuKeyboard()
        });
    } else {
        await ctx.reply('Обсуждение завершено. Возвращаюсь в обычный режим.', {
            reply_markup: getMainMenuKeyboard()
        });
    }
    await ctx.answerCallbackQuery();
  });

  // Обработчик текстовых сообщений для состояний
  bot.on('message:text', async (ctx, next) => {
    const step = ctx.session.step;

    // --- Запись в дневник ---
    if (step === 'waiting_for_diary_note') {
        if (!await requireAccess(ctx)) return;

        const text = ctx.message.text;
        const dayNumber = ctx.session.data.currentDiaryDay || 1;
        const type = ctx.session.data.diaryType || 'general';

        await prisma.diaryEntry.create({
            data: {
                userId: ctx.dbUser!.id,
                dayNumber: dayNumber,
                type: type,
                note: text
            }
        });

        const wasEvening = type === 'evening';

        ctx.session.step = undefined;
        ctx.session.data.currentDiaryDay = undefined;
        ctx.session.data.diaryType = undefined;

        if (wasEvening) {
             const message = await getMessage('evening_completed', 'Ты не просто читаешь — ты проживаешь...');
             await ctx.reply(message, { reply_markup: getMainMenuKeyboard() });
        } else {
            await ctx.reply('✅ Заметка сохранена в дневник!', {
                reply_markup: getMainMenuKeyboard()
            });
        }
        return;
    }

    // --- Чат с AI ---
    if (step === 'chatting_with_ai') {
        if (!await requireAccess(ctx)) return;

        const text = ctx.message.text;
        const principle = ctx.session.data.currentPrinciple;
        const context = ctx.session.data.aiContext;
        
        if (!process.env.OPENROUTER_API_KEY) {
            await ctx.reply('⚠️ AI сервис временно недоступен (нет ключа).');
            return;
        }

        await ctx.api.sendChatAction(ctx.chat.id, 'typing');

        try {
            let systemPrompt = '';

            if (context === 'principle' && principle) {
                 systemPrompt = 
                    `Ты — профессиональный трансерфер и наставник.\n` +
                    `Пользователь изучает принцип: "${principle.title}".\n` +
                    `Текст: "${principle.declaration} ${principle.description}".\n` +
                    `Твоя цель: помочь углубить понимание этого принципа.\n` +
                    `Отвечай в стиле Зеланда, кратко (до 200 слов).`;
            } else if (context === 'day') {
                 const principleInfo = principle ? `Сегодняшний принцип был: "${principle.title}".` : '';
                 systemPrompt = 
                    `Ты — профессиональный трансерфер и наставник.\n` +
                    `Пользователь подводит итоги дня.\n` +
                    `${principleInfo}\n` +
                    `Твоя цель: помочь пользователю осознать моменты пробуждения или сна, проанализировать день через призму Трансерфинга.\n` +
                    `Отвечай мягко, поддерживающе, в стиле Зеланда.`;
            } else if (context === 'diary_entry') {
                 const dayNumber = ctx.session.data.currentDiaryDay;
                 let entriesText = '';
                 if (dayNumber) {
                     const entries = await prisma.diaryEntry.findMany({
                         where: { userId: ctx.dbUser!.id, dayNumber },
                         orderBy: { createdAt: 'asc' }
                     });
                     entriesText = entries.map(e => `[${e.type}]: ${e.note}`).join('\n');
                 }
                 const principleInfo = principle ? `Принцип дня: "${principle.title}".` : '';
                 
                 systemPrompt = 
                    `Ты — профессиональный трансерфер.\n` +
                    `Пользователь обсуждает свои записи в дневнике за день ${dayNumber || '?'}.\n` +
                    `${principleInfo}\n` +
                    `Записи пользователя:\n${entriesText}\n\n` +
                    `Твоя цель: помочь проанализировать эти наблюдения, дать обратную связь в стиле Трансерфинга.\n` +
                    `Отвечай вдумчиво, используй термины (важность, маятники, фрейле).`;
            } else {
                 systemPrompt = 
                    `Ты — профессиональный трансерфер и наставник (коуч).\n` +
                    `Помогай пользователю разбираться с жизненными ситуациями, применяя принципы Трансерфинга реальности (Вадим Зеланд).\n` +
                    `Используй терминологию: маятники, избыточный потенциал, равновесные силы, координация намерения, фрейле, слайд.\n` +
                    `Отвечай мудро, спокойно, вдохновляюще.`;
            }

            const completion = await openai.chat.completions.create({
                model: "openai/gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: text }
                ],
            });

            const reply = completion.choices[0].message.content || 'Извините, я не смог сформулировать ответ.';
            
            const keyboard = new InlineKeyboard()
                .text('❌ Закончить обсуждение', 'stop_ai_chat');

            await ctx.reply(reply, { reply_markup: keyboard });

        } catch (error) {
            console.error('AI Error:', error);
            await ctx.reply('Произошла ошибка при общении с нейросетью. Попробуйте позже.');
        }
        return;
    }

    await next();
  });
}
