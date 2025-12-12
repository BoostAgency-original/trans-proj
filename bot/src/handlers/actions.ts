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
    // Текущий принцип = currentPrincipleDay - 1
    const dayNumber = Math.max(1, user.currentPrincipleDay - 1);
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
    // Текущий принцип = currentPrincipleDay - 1
    const dayNumber = Math.max(1, user.currentPrincipleDay - 1);
    ctx.session.data.currentDiaryDay = dayNumber;

    await ctx.reply(
      '📝 Напишите, как прошел ваш день.\n' +
      'Следующее сообщение будет сохранено в дневник.'
    );
    await ctx.answerCallbackQuery();
  });


  // 2. Напомнить позже (2 часа) - утреннее сообщение
  bot.callbackQuery('remind_later_2h', async (ctx) => {
    const nextTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // +2 часа
    
    await prisma.user.update({
        where: { id: ctx.dbUser!.id },
        data: { nextMorningMessageAt: nextTime }
    });

    await ctx.reply('⏰ Хорошо, я напомню вам об этом через 2 часа.');
    await ctx.answerCallbackQuery();
  });

  // 2b. Напомнить позже (2 часа) - вечернее сообщение
  bot.callbackQuery('remind_evening_2h', async (ctx) => {
    // Для тестов: 1 минута, в продакшене: 2 * 60 * 60 * 1000
    // const nextTime = new Date(Date.now() + 1 * 60 * 1000); // +1 минута (для тестов)
    const nextTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // +2 часа (продакшен)
    
    await prisma.user.update({
        where: { id: ctx.dbUser!.id },
        data: { nextEveningMessageAt: nextTime }
    });

    await ctx.reply('⏰ Хорошо, напомню через некоторое время.');
    await ctx.answerCallbackQuery();
  });

  // 3. Обсудить принцип с AI
  bot.callbackQuery('ai_discuss_principle', async (ctx) => {
    const user = ctx.dbUser!;
    
    // Текущий принцип = currentPrincipleDay - 1 (счётчик указывает на СЛЕДУЮЩИЙ)
    // Минимум 1, чтобы не было 0
    const dayNumber = Math.max(1, user.currentPrincipleDay - 1);
    
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
    
    // Текущий принцип = currentPrincipleDay - 1
    const dayNumber = Math.max(1, user.currentPrincipleDay - 1);

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

            // Базовые инструкции для всех контекстов
            const baseInstructions = `
ВАЖНО: Ты — мастер Трансерфинга реальности по Вадиму Зеланду. НЕ психолог и НЕ коуч.

КЛЮЧЕВЫЕ КОНЦЕПЦИИ (используй их активно):
• ФРЕЙЛИНГ (фрейле) — состояние внутренней свободы, лёгкости, игры. Когда ты ничего не "хочешь", а просто позволяешь себе иметь. Это главная магия!
• ИНВЕРСИЯ НАМЕРЕНИЯ — не "хотеть" (это создаёт избыточный потенциал), а "намереваться иметь". Разница между "хочу машину" и "я еду на своей машине".
• СНИЖЕНИЕ ВАЖНОСТИ — чем больше ты чего-то хочешь, тем сильнее это отталкиваешь. Отпусти важность — и получишь.
• МАЯТНИКИ — энергоинформационные структуры, которые питаются твоей энергией через эмоции (страх, гнев, тревога). Не борись — просто не давай энергию.
• ИЗБЫТОЧНЫЙ ПОТЕНЦИАЛ — напряжение, которое создаёшь, придавая чему-то слишком большое значение. Равновесные силы устраняют его — часто не в твою пользу.
• СЛАЙДЫ — ментальные картинки желаемой реальности. Крути их в голове как уже свершившееся.
• КООРДИНАЦИЯ НАМЕРЕНИЯ — единство души (хочу) и разума (могу). Когда оба согласны — реальность сдвигается.
• ЛИНИИ ЖИЗНИ — параллельные варианты реальности. Ты выбираешь линию своим намерением и вниманием.

СТИЛЬ ОТВЕТА:
- Говори как мудрый практик, а не теоретик
- Используй метафоры из Трансерфинга (зеркало мира, маятники, течение вариантов)
- Направляй к ДЕЙСТВИЮ через намерение, а не через усилие
- Напоминай про фрейлинг и лёгкость — это ключ
- Кратко (до 200 слов), но ёмко
`;

            if (context === 'principle' && principle) {
                 systemPrompt = baseInstructions +
                    `\nКОНТЕКСТ: Пользователь изучает принцип "${principle.title}".\n` +
                    `Декларация: "${principle.declaration}"\n` +
                    `Описание: "${principle.description}"\n\n` +
                    `ЗАДАЧА: Помоги глубже понять этот принцип через призму Трансерфинга. ` +
                    `Покажи как применить его через фрейлинг и намерение, а не через усилие и борьбу.`;
            } else if (context === 'day') {
                 const principleInfo = principle ? `Сегодняшний принцип: "${principle.title}".` : '';
                 systemPrompt = baseInstructions +
                    `\nКОНТЕКСТ: Пользователь подводит итоги дня. ${principleInfo}\n\n` +
                    `ЗАДАЧА: Помоги проанализировать день через Трансерфинг:\n` +
                    `- Где были маятники? Давал ли им энергию?\n` +
                    `- Где создавал избыточный потенциал (придавал важность)?\n` +
                    `- Были ли моменты фрейлинга (лёгкости, игры)?\n` +
                    `- Как можно было применить инверсию намерения?\n` +
                    `Направляй к осознанности и лёгкости.`;
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
                 
                 systemPrompt = baseInstructions +
                    `\nКОНТЕКСТ: Пользователь обсуждает записи дневника за день ${dayNumber || '?'}.\n` +
                    `${principleInfo}\n` +
                    `Записи:\n${entriesText}\n\n` +
                    `ЗАДАЧА: Проанализируй записи через Трансерфинг. ` +
                    `Найди моменты, где можно было применить фрейлинг, снижение важности, инверсию намерения. ` +
                    `Дай практичную обратную связь.`;
            } else {
                 systemPrompt = baseInstructions +
                    `\nКОНТЕКСТ: Свободный разговор о жизненных ситуациях.\n\n` +
                    `ЗАДАЧА: Помогай разбирать ситуации ТОЛЬКО через призму Трансерфинга. ` +
                    `Не давай психологических советов. Показывай как применить:\n` +
                    `- Фрейлинг (перейти в состояние игры и лёгкости)\n` +
                    `- Инверсию намерения (не хотеть, а намереваться иметь)\n` +
                    `- Снижение важности (отпустить хватку)\n` +
                    `- Работу с маятниками (не бороться, не давать энергию)`;
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

            // Пробуем отправить с Markdown, если ошибка — без форматирования
            try {
                await ctx.reply(reply, { reply_markup: keyboard, parse_mode: 'Markdown' });
            } catch {
                await ctx.reply(reply, { reply_markup: keyboard });
            }

        } catch (error) {
            console.error('AI Error:', error);
            await ctx.reply('Произошла ошибка при общении с нейросетью. Попробуйте позже.');
        }
        return;
    }

    await next();
  });
}
