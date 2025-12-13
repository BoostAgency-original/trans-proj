import { BotContext } from '../types';
import { getMessage } from './messages';
import { getSubscriptionKeyboard } from '../keyboards';

/**
 * Проверяет, есть ли у пользователя активный доступ (триал или подписка).
 * @param ctx Контекст бота
 * @returns true, если доступ есть
 */
export function hasActiveAccess(ctx: BotContext): boolean {
    const user = ctx.dbUser;
    if (!user || !user.subscription) return false;
    const sub = user.subscription;
    if (!sub.isActive) return false;
    // Если это платная подписка — она активна только пока expiresAt > now
    if (sub.expiresAt) {
      return sub.expiresAt > new Date();
    }
    // Иначе (trial) isActive=true, а деактивацию выполняем после окончания триала
    return true;
}

/**
 * Проверяет доступ и отправляет сообщение о необходимости подписки, если доступа нет.
 * @param ctx Контекст бота
 * @returns true, если доступ есть, false если нет (сообщение отправлено)
 */
export async function requireAccess(ctx: BotContext): Promise<boolean> {
    if (hasActiveAccess(ctx)) {
        return true;
    }

    const defaultMsg = `Ты проснулся в сновидении. Это уже сила.

Эти семь дней были не случайны. Ты почувствовал — что-то в тебе меняется.
Мир стал чуть мягче. Внутри — чуть яснее.
Это работает.

У трансформации есть ритм.
И она просит продолжения.

Если хочешь идти глубже — путь открыт.
Осталось 73 шага.

Открой практику полностью — и начни управлять реальностью осознанно.`;
    const message = await getMessage('subscription_inactive', defaultMsg);
    
    // Не используем клавиатуру подписки по умолчанию, чтобы избежать нагромождения кнопок, 
    // если пользователь хочет просто получить уведомление.
    // Но пользователь просит: "Buttons and some shit".
    // "Just make it so that a message is displayed that It's time to buy a subscription. There are some buttons..."
    // Мы используем getSubscriptionKeyboard(), которая как раз содержит кнопки тарифов.
    
    try {
        await ctx.reply(message, { 
            reply_markup: getSubscriptionKeyboard() 
        });
    } catch (e) {
        console.error('Failed to send access denied message', e);
    }
    
    return false;
}

