import { Bot } from 'grammy';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import type { BotContext } from '../types';
import { getDiaryNavigationKeyboard, getMainMenuKeyboard } from '../keyboards';
import { requireAccess } from '../services/access';

const prisma = new PrismaClient();

// Показать список дней
export async function showDiaryList(ctx: BotContext) {
    const userId = ctx.dbUser!.id;
    
    // Получаем все записи, группируем по дням
    const entries = await prisma.diaryEntry.findMany({
        where: { userId },
        distinct: ['dayNumber'],
        orderBy: { dayNumber: 'asc' },
        select: { dayNumber: true }
    });

    if (entries.length === 0) {
        await ctx.reply('У вас пока нет записей в дневнике.', {
            reply_markup: getMainMenuKeyboard()
        });
        return;
    }

    let message = '📔 <b>Ваш дневник наблюдений</b>\n\n';
    
    for (const entry of entries) {
        const principle = await prisma.transurfingPrinciple.findUnique({
            where: { dayNumber: entry.dayNumber }
        });
        const title = principle ? principle.title : 'Неизвестный принцип';
        message += `${entry.dayNumber}. ${title}\n`;
    }

    message += '\nВведите номер дня, чтобы посмотреть записи:';

    ctx.session.step = 'waiting_for_diary_day_selection';
    await ctx.reply(message, { parse_mode: 'HTML' });
}

// Показать запись за конкретный день
async function showDiaryEntry(ctx: BotContext, dayNumber: number) {
    const userId = ctx.dbUser!.id;

    const entries = await prisma.diaryEntry.findMany({
        where: { userId, dayNumber },
        orderBy: { createdAt: 'asc' }
    });

    if (entries.length === 0) {
        await ctx.reply('Записи за этот день не найдены.');
        return;
    }

    const principle = await prisma.transurfingPrinciple.findUnique({
        where: { dayNumber }
    });

    let text = `📅 <b>День ${dayNumber}</b>\n`;
    if (principle) {
        text += `Принцип: <i>${principle.title}</i>\n`;
    }
    text += '\n';

    entries.forEach(entry => {
        const typeIcon = entry.type === 'morning' ? '🌅' : entry.type === 'evening' ? '🌙' : '📝';
        text += `${typeIcon} ${entry.note}\n\n`;
    });

    // Проверяем, есть ли следующий день с записями
    const nextEntry = await prisma.diaryEntry.findFirst({
        where: { 
            userId, 
            dayNumber: { gt: dayNumber } 
        },
        orderBy: { dayNumber: 'asc' }
    });

    ctx.session.data.currentDiaryDay = dayNumber;
    ctx.session.data.currentPrinciple = principle; // Сохраняем для AI контекста

    await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: getDiaryNavigationKeyboard(!!nextEntry)
    });
}

export function setupDiaryHandlers(bot: Bot<BotContext>) {
    
    // Обработчик текстового ввода номера дня
    bot.on('message:text', async (ctx, next) => {
        if (ctx.session.step === 'waiting_for_diary_day_selection') {
            if (!await requireAccess(ctx)) {
                ctx.session.step = undefined;
                return;
            }

            const dayNumber = parseInt(ctx.message.text);
            
            if (isNaN(dayNumber)) {
                await ctx.reply('Пожалуйста, введите число.');
                return;
            }

            await showDiaryEntry(ctx, dayNumber);
            ctx.session.step = undefined; // Сбрасываем шаг, так как перешли в режим просмотра с кнопками
            return;
        }
        await next();
    });

    // Кнопка "Дальше"
    bot.callbackQuery('diary_next', async (ctx) => {
        if (!await requireAccess(ctx)) {
            await ctx.answerCallbackQuery();
            return;
        }

        const currentDay = ctx.session.data.currentDiaryDay;
        if (!currentDay) return;

        const nextEntry = await prisma.diaryEntry.findFirst({
            where: { 
                userId: ctx.dbUser!.id, 
                dayNumber: { gt: currentDay } 
            },
            orderBy: { dayNumber: 'asc' }
        });

        if (nextEntry) {
            await showDiaryEntry(ctx, nextEntry.dayNumber);
        } else {
            await ctx.answerCallbackQuery('Это последняя запись.');
        }
        await ctx.answerCallbackQuery();
    });

    // Кнопка "Выйти"
    bot.callbackQuery('diary_exit', async (ctx) => {
        ctx.session.data.currentDiaryDay = undefined;
        await ctx.reply('Вы вышли в главное меню.', {
            reply_markup: getMainMenuKeyboard()
        });
        try {
            await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        } catch (e) {}
        await ctx.answerCallbackQuery();
    });

    // Кнопка "Обсудить с AI"
    bot.callbackQuery('diary_discuss', async (ctx) => {
        if (!await requireAccess(ctx)) {
            await ctx.answerCallbackQuery();
            return;
        }

        const dayNumber = ctx.session.data.currentDiaryDay;
        if (!dayNumber) return;

        ctx.session.step = 'chatting_with_ai';
        ctx.session.data.aiContext = 'diary_entry';
        
        await ctx.reply(
            '🧠 Я готов обсудить ваши записи за этот день.\n' +
            'Что именно вы хотите разобрать или уточнить?'
        );
        await ctx.answerCallbackQuery();
    });
}
