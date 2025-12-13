import { Context, SessionFlavor } from 'grammy';
import type { User, Subscription } from '@prisma/client';

export interface SessionData {
  step?: 'intro_name' | 'intro_gender' | 'intro_step4' | 'intro_step5' | 'intro_step6' | 'chatting_with_ai' | 'waiting_for_diary_note' | 'waiting_for_diary_day_selection' | 'waiting_for_settings_name';
  data: {
      currentPrinciple?: any;
      currentDiaryDay?: number;
      diaryType?: 'morning' | 'evening';
      aiContext?: 'principle' | 'day' | 'diary_entry' | 'weekly_analytics';
      weeklyAnalytics?: any;
      [key: string]: any;
  };
}

export type BotContext = Context & SessionFlavor<SessionData> & {
  dbUser?: User & { subscription: Subscription | null };
};
