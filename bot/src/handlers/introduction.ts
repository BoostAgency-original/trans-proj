import { Bot, InlineKeyboard } from 'grammy';
import { PrismaClient } from '@prisma/client';
import type { BotContext } from '../types';
import { getMainMenuKeyboard, getMorningKeyboard } from '../keyboards';
import { getMessage } from '../services/messages';

const prisma = new PrismaClient();

// Простая проверка на мат (можно расширить)
const BAD_WORDS = ['хуй', 'пизд', 'ебат', 'бля', 'сука', 'ебан', 'говно', 'мудак'];

function containsBadWords(text: string): boolean {
  const lowerText = text.toLowerCase();
  return BAD_WORDS.some(word => lowerText.includes(word));
}

// Дефолтные тексты на случай, если база пуста
const DEFAULT_TEXTS = {
  step1: 'Привет. Я — Трансерфер.\n\nГотов начать?',
  step2: 'Как я могу к тебе обращаться?\nПросто напиши имя или псевдоним.',
  step3: 'Отлично. В каком роде я могу к тебе обращаться – в мужском или женском?',
  step4: 'С этого момента ты в практике.\n\nГотов продолжать?',
  step5: 'Ты не наблюдатель жизни. Ты её соавтор.\n\nВсё начинается сейчас.',
  step6: 'Ты меняешься не в тот момент, когда читаешь. А в тот момент, когда замечаешь.\n\nГотов начать?',
  finish: '🎉 Поздравляю! Ты прошел вводную часть.\n\nТеперь тебе доступно главное меню и все функции бота.'
};

export function setupIntroductionHandlers(bot: Bot<BotContext>) {
  // Шаг 1: Кнопка "Готов"
  bot.callbackQuery('intro_start', async (ctx) => {
    if (ctx.dbUser?.isIntroCompleted) return;
    
    ctx.session.step = 'intro_name';
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    } catch (e) {}

    const text = await getMessage('intro_step_2', DEFAULT_TEXTS.step2);
    await ctx.reply(text);
    await ctx.answerCallbackQuery();
  });

  // Шаг 2: Ввод имени (текстом)
  bot.on('message:text', async (ctx, next) => {
    if (ctx.session.step === 'intro_name') {
      const name = ctx.message.text.trim();
      
      if (containsBadWords(name)) {
        await ctx.reply('❌ Такое имя недопустимо. Пожалуйста, выберите другое.');
        return;
      }
      
      if (name.length > 50) {
        await ctx.reply('❌ Имя слишком длинное. Пожалуйста, используйте до 50 символов.');
        return;
      }

      // Сохраняем имя
      await prisma.user.update({
        where: { id: ctx.dbUser!.id },
        data: { name }
      });

      ctx.session.step = 'intro_step4';
      
      const keyboard = new InlineKeyboard()
        .text('Да, я готов', 'intro_ready');

      const text = await getMessage('intro_step_4', DEFAULT_TEXTS.step4);
      await ctx.reply(text, { reply_markup: keyboard });
      return;
    }
    
    await next();
  });

  // Шаг 3: Выбор пола (УДАЛЕНО)
  /*
  bot.callbackQuery(['gender_male', 'gender_female'], async (ctx) => {
     // ... logic removed ...
  });
  */

  // Шаг 4: "Да, я готов"
  bot.callbackQuery('intro_ready', async (ctx) => {
    if (ctx.session.step !== 'intro_step4') {
        await ctx.answerCallbackQuery('Этот шаг уже пройден');
        return;
    }

    ctx.session.step = 'intro_step5';
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    } catch (e) {}

    const keyboard = new InlineKeyboard()
      .text('Да', 'intro_yes');

    const text = await getMessage('intro_step_5', DEFAULT_TEXTS.step5);
    await ctx.reply(text, { reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // Шаг 5: "Да" (переход к шагу 6)
  bot.callbackQuery('intro_yes', async (ctx) => {
    if (ctx.session.step !== 'intro_step5') {
        await ctx.answerCallbackQuery('Этот шаг уже пройден');
        return;
    }

    ctx.session.step = 'intro_step6';
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    } catch (e) {}

    const keyboard = new InlineKeyboard()
      .text('Да, начать первый принцип', 'intro_finish');

    const text = await getMessage('intro_step_6', DEFAULT_TEXTS.step6);
    await ctx.reply(text, { reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // Шаг 6: Завершение
  bot.callbackQuery('intro_finish', async (ctx) => {
    if (ctx.session.step !== 'intro_step6') {
        await ctx.answerCallbackQuery('Этот шаг уже пройден');
        return;
    }

    // Завершаем сценарий и активируем триал
    await prisma.user.update({
      where: { id: ctx.dbUser!.id },
      data: { 
        isIntroCompleted: true,
        introCompletedAt: new Date() // Фиксируем время завершения интро
      }
    });

    // Создаем или обновляем подписку (активируем триал)
    await prisma.subscription.upsert({
        where: { userId: ctx.dbUser!.id },
        update: {
            isActive: true,
            activatedAt: new Date(),
            trialDaysUsed: 0,
        },
        create: {
            userId: ctx.dbUser!.id,
            isActive: true,
            activatedAt: new Date(),
            trialDaysUsed: 0,
        }
    });

    ctx.session.step = undefined;
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    } catch (e) {}

    // Отправляем первый принцип немедленно
    const principle = await prisma.transurfingPrinciple.findUnique({
      where: { dayNumber: 1 }
    });

    if (principle) {
        const name = ctx.dbUser?.name || ctx.dbUser?.firstName || 'друг';
        const message = `Доброе утро, ${name}!\n\n` +
          `День 1. Принцип: ${principle.title}\n\n` +
          `Декларация:\n\n${principle.declaration}\n\n` +
          `Пояснение:\n${principle.description}\n\n` +
          `Сегодня наблюдай:\n\n${principle.task}`;

        await ctx.reply(message, {
            reply_markup: getMorningKeyboard()
        });
    } else {
        // Fallback если принципа нет
        const text = await getMessage('intro_finish', DEFAULT_TEXTS.finish);
        await ctx.reply(text, {
            reply_markup: getMainMenuKeyboard()
        });
    }
    
    await ctx.answerCallbackQuery();
  });
}

// Функция для запуска сценария (вызывается из /start)
export async function startIntroduction(ctx: BotContext) {
  const keyboard = new InlineKeyboard()
    .text('🚀 Готов начать', 'intro_start');

  const text = await getMessage('intro_step_1', DEFAULT_TEXTS.step1);
  await ctx.reply(text, { reply_markup: keyboard });
}
