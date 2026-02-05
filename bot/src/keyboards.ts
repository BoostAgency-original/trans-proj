import { InlineKeyboard } from 'grammy';

// Главное меню (Inline)
export function getMainMenuKeyboard() {
  return new InlineKeyboard()
    .text('📢 Канал', 'menu_channel').text('⚙️ Настройки', 'menu_settings').row()
    .text('💎 Подписка', 'menu_subscription').text('🎁 Подарить подписку', 'menu_gift').row()
    .text('🆘 Техподдержка', 'menu_support').row()
    .text('📔 Дневник наблюдений', 'menu_diary').row()
    .text('🧠 Обсудить', 'menu_discuss');
}

export function getGiftPlansKeyboard() {
  return new InlineKeyboard()
    .text('🎁 1 неделя (159₽)', 'gift_plan_sub_plan_week').row()
    .text('🎁 1 месяц (399₽)', 'gift_plan_sub_plan_month').row()
    .text('🎁 80 дней (999₽)', 'gift_plan_sub_plan_80days').row()
    .url('🌟 Или через Tribute', TRIBUTE_LINK).row()
    .text('🚪 Выйти', 'menu_main');
}

// Меню подписки (Inline)
export function getSubscriptionKeyboard() {
  return new InlineKeyboard()
    .text('1 неделя (159₽)', 'sub_plan_week').row()
    .text('1 месяц (399₽)', 'sub_plan_month').row()
    .text('80 дней (999₽)', 'sub_plan_80days').row()
    .url('🌟 Или через Tribute', TRIBUTE_LINK).row()
    .text('🆘 Техподдержка', 'menu_support').row()
    .text('🚪 Выйти', 'menu_main');
}

// Ссылка на Tribute Mini App (настраивается в env)
const TRIBUTE_LINK = process.env.TRIBUTE_LINK || 'https://t.me/tribute/app?startapp=sNhG';

// Выбор способа оплаты после выбора тарифа
export function getPaymentMethodKeyboard(planId: string) {
  return new InlineKeyboard()
    .text('💳 Картой (ЮКасса)', `confirm_buy_${planId}`).row()
    .url('🌟 Через Tribute', TRIBUTE_LINK).row()
    .text('« Назад', 'menu_subscription');
}

// Выбор способа оплаты для подарка
export function getGiftPaymentMethodKeyboard(planId: string) {
  return new InlineKeyboard()
    .text('💳 Картой (ЮКасса)', `confirm_gift_${planId}`).row()
    .url('🌟 Через Tribute', TRIBUTE_LINK).row()
    .text('« Назад', 'menu_gift');
}

// Выбор способа оплаты для промо (до триала)
export function getPromoPaymentMethodKeyboard(isMonth: boolean) {
  const callbackData = isMonth ? 'promo_buy_month_299' : 'promo_buy_80days_799';
  return new InlineKeyboard()
    .text('💳 Картой (ЮКасса)', callbackData).row()
    .url('🌟 Через Tribute', TRIBUTE_LINK).row()
    .text('« Назад', 'back_to_promo_offer');
}

// Меню продолжения (после триала)
export function getContinuePathKeyboard() {
  return new InlineKeyboard()
    .text('1 неделя (159₽)', 'sub_plan_week').row()
    .text('1 месяц (399₽)', 'sub_plan_month').row()
    .text('80 дней (999₽)', 'sub_plan_80days').row()
    .url('🌟 Или через Tribute', TRIBUTE_LINK).row()
    .text('🆘 Техподдержка', 'menu_support').row()
    .text('🚪 Выйти', 'menu_main');
}

// Кнопка для "Напомнить позже" (после триала)
export function getRemindLaterTrialKeyboard() {
    return new InlineKeyboard()
        .text('Нет, спасибо', 'trial_no_thanks');
}

// Кнопка назад в меню
export function getBackToMenuKeyboard() {
  return new InlineKeyboard()
    .text('◀️ Назад в меню', 'menu_main');
}

// Клавиатура для утреннего сообщения с принципом
export function getMorningKeyboard() {
  return new InlineKeyboard()
    .text('📝 Записать в дневник', 'diary_add_auto').row()
    .text('🧠 Обсудить принцип', 'ai_discuss_principle').row()
    .text('⏰ Напомнить позже (2ч)', 'remind_later_2h');
}

// Клавиатура для вечернего сообщения
export function getEveningKeyboard() {
  return new InlineKeyboard()
    .text('📝 Записать в дневник', 'diary_add_evening').row()
    .text('🌙 Обсудить день', 'ai_discuss_day').row()
    .text('⏰ Напомнить позже (2ч)', 'remind_evening_2h').row()
    .text('⏭ Пропустить день', 'skip_day');
}

// Клавиатура для недельной аналитики (каждый 7-й день)
export function getWeeklyAnalyticsKeyboard(weekNumber: number) {
  return new InlineKeyboard()
    .text('🧠 Обсудить аналитику', `ai_discuss_weekly_${weekNumber}`).row()
    .text('📝 Записать в дневник', 'diary_add_evening').row()
    .text('⏭ Пропустить', `skip_weekly_${weekNumber}`);
}

// Оффер после интро (до старта триала)
export function getPostIntroOfferKeyboard() {
  return new InlineKeyboard()
    .text('💎 1 месяц — 299₽ (картой)', 'promo_buy_month_299').row()
    .text('💎 80 дней — 799₽ (картой)', 'promo_buy_80days_799').row()
    .url('🌟 Оплатить через Tribute', TRIBUTE_LINK).row()
    .text('🚀 Начать бесплатный период', 'start_trial');
}

// Навигация по дневнику
export function getDiaryNavigationKeyboard(hasNext: boolean) {
  const keyboard = new InlineKeyboard();
  
  if (hasNext) {
      keyboard.text('Дальше ➡️', 'diary_next').row();
  }
  
  keyboard.text('🧠 Обсудить с AI', 'diary_discuss').row();
  keyboard.text('🚪 Выйти', 'diary_exit');
  
  return keyboard;
}

// Меню настроек
export function getSettingsKeyboard() {
  return new InlineKeyboard()
    .text('✏️ Изменить имя', 'settings_edit_name').row()
    .text('🕒 Изменить время (пояс)', 'settings_edit_time').row()
    .text('◀️ Назад в меню', 'menu_main');
}

// Выбор пола (для настроек) - REMOVED
/*
export function getGenderEditKeyboard() {
  return new InlineKeyboard()
    .text('Мужской', 'settings_gender_male').text('Женский', 'settings_gender_female').row()
    .text('🔙 Отмена', 'settings_back');
}
*/

// Выбор часового пояса
export function getTimezoneKeyboard() {
  return new InlineKeyboard()
    .text('Калининград (-1 МСК)', 'tz_Europe/Kaliningrad').row()
    .text('Москва (МСК)', 'tz_Europe/Moscow').row()
    .text('Самара (+1 МСК)', 'tz_Europe/Samara').row()
    .text('Екатеринбург (+2 МСК)', 'tz_Asia/Yekaterinburg').row()
    .text('Омск (+3 МСК)', 'tz_Asia/Omsk').row()
    .text('Красноярск (+4 МСК)', 'tz_Asia/Krasnoyarsk').row()
    .text('Иркутск (+5 МСК)', 'tz_Asia/Irkutsk').row()
    .text('Якутск (+6 МСК)', 'tz_Asia/Yakutsk').row()
    .text('Владивосток (+7 МСК)', 'tz_Asia/Vladivostok').row()
    .text('Магадан (+8 МСК)', 'tz_Asia/Magadan').row()
    .text('Камчатка (+9 МСК)', 'tz_Asia/Kamchatka').row()
    .text('🔙 Отмена', 'settings_back');
}

// Клавиатура для сообщения об окончании триала
export function getTrialExpiredKeyboard() {
  return new InlineKeyboard()
    .text('🚀 Продолжить путь', 'menu_subscription').row()
    .url('🌟 Оплатить через Tribute', TRIBUTE_LINK).row()
    .text('⏰ Напомнить позже', 'trial_remind_later');
}

// Кнопка отмены ввода (для имени)
export function getCancelKeyboard() {
    return new InlineKeyboard().text('🔙 Отмена', 'settings_back');
}
