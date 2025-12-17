import { useEffect, useMemo, useRef, useState } from 'react';
import { Users, CreditCard, BookOpen, TrendingUp } from 'lucide-react';
import {
  getUsers,
  getSubscriptions,
  getDiaryStats,
  getBroadcastStats,
  getBroadcasts,
  createBroadcast,
  cancelBroadcast,
} from '../api/api';
import './Dashboard.css';

interface Stats {
  totalUsers: number;
  activeSubscriptions: number;
  totalDiaryEntries: number;
  usersWithDiary: number;
}

type Audience = 'all' | 'intro_not_completed' | 'paid_active' | 'no_paid_active';
type ParseMode = null | 'MarkdownV2';

interface BroadcastStats {
  all: number;
  intro_not_completed: number;
  paid_active: number;
  no_paid_active: number;
  updatedAt: string;
}

interface Broadcast {
  id: number;
  audience: Audience;
  text: string;
  parseMode: ParseMode;
  status: string;
  totalTargets: number;
  sentCount: number;
  failedCount: number;
  error?: string | null;
  createdAt: string;
}

const Dashboard = () => {
  const broadcastTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeSubscriptions: 0,
    totalDiaryEntries: 0,
    usersWithDiary: 0,
  });
  const [loading, setLoading] = useState(true);

  const [broadcastStats, setBroadcastStats] = useState<BroadcastStats | null>(null);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [broadcastAudience, setBroadcastAudience] = useState<Audience>('all');
  const [broadcastParseMode, setBroadcastParseMode] = useState<ParseMode>('MarkdownV2');
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);

  // MarkdownV2: оборачивает выделенный текст в теги
  const applyWrap = (open: string, close: string, placeholder: string) => {
    const el = broadcastTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const before = broadcastText.slice(0, start);
    const selected = broadcastText.slice(start, end);
    const after = broadcastText.slice(end);

    const inner = selected.length > 0 ? selected : placeholder;
    const next = `${before}${open}${inner}${close}${after}`;
    setBroadcastText(next);

    // восстановим фокус и выделение
    requestAnimationFrame(() => {
      el.focus();
      if (selected.length > 0) {
        el.setSelectionRange(start, start + open.length + inner.length + close.length);
      } else {
        el.setSelectionRange(start + open.length, start + open.length + inner.length);
      }
    });
  };

  const applyLink = () => {
    const url = window.prompt('Ссылка (URL):', 'https://');
    if (!url) return;
    const el = broadcastTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const before = broadcastText.slice(0, start);
    const selected = broadcastText.slice(start, end);
    const after = broadcastText.slice(end);

    const linkText = selected.length > 0 ? selected : 'ссылка';
    // В MarkdownV2 ссылка: [текст](url)
    const next = `${before}[${linkText}](${url})${after}`;
    setBroadcastText(next);

    requestAnimationFrame(() => {
      el.focus();
    });
  };

  const stripFormatting = () => {
    // Убираем Markdown-форматирование
    setBroadcastText((prev) =>
      prev
        .replace(/\*\*(.+?)\*\*/g, '$1') // **bold**
        .replace(/\*(.+?)\*/g, '$1') // *bold*
        .replace(/__(.+?)__/g, '$1') // __underline__
        .replace(/_(.+?)_/g, '$1') // _italic_
        .replace(/~~(.+?)~~/g, '$1') // ~~strike~~ (не telegram, но на всякий)
        .replace(/~(.+?)~/g, '$1') // ~strike~
        .replace(/\|\|(.+?)\|\|/g, '$1') // ||spoiler||
        .replace(/`(.+?)`/g, '$1') // `code`
        .replace(/```[\s\S]*?```/g, '') // ```code block```
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) -> text
    );
  };

  const audienceLabel: Record<Audience, string> = useMemo(
    () => ({
      all: 'Все пользователи',
      intro_not_completed: 'Не прошли вводный сценарий',
      paid_active: 'С активной подпиской',
      no_paid_active: 'Без активной платной подписки',
    }),
    []
  );

  useEffect(() => {
    void fetchStats();
    void fetchBroadcastData();
  }, []);

  const fetchStats = async () => {
    try {
      const [usersRes, subsRes, diaryRes] = await Promise.all([getUsers(), getSubscriptions(), getDiaryStats()]);

      setStats({
        totalUsers: usersRes.data.length,
        activeSubscriptions: subsRes.data.filter((s: any) => s.isActive).length,
        totalDiaryEntries: diaryRes.data.totalEntries,
        usersWithDiary: diaryRes.data.totalUsers,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBroadcastData = async () => {
    try {
      const [statsRes, listRes] = await Promise.all([getBroadcastStats(), getBroadcasts(20)]);
      setBroadcastStats(statsRes.data);
      setBroadcasts(listRes.data);
    } catch (error) {
      console.error('Error fetching broadcast data:', error);
      const anyErr = error as any;
      setBroadcastError(anyErr?.response?.data?.error || 'Ошибка загрузки данных рассылок');
    }
  };

  const onCreateBroadcast = async () => {
    setBroadcastError(null);
    setBroadcastSuccess(null);

    if (!broadcastText.trim()) {
      setBroadcastError('Текст рассылки пустой');
      return;
    }

    setBroadcastSending(true);
    try {
      const res = await createBroadcast({
        audience: broadcastAudience,
        text: broadcastText,
        parseMode: broadcastParseMode,
      });
      setBroadcastSuccess(`Рассылка #${res.data.id} создана (статус: ${res.data.status}).`);
      setBroadcastText('');
      await fetchBroadcastData();
    } catch (error: any) {
      console.error('Error creating broadcast:', error);
      setBroadcastError(error?.response?.data?.error || 'Ошибка при создании рассылки');
    } finally {
      setBroadcastSending(false);
    }
  };

  const onCancelBroadcast = async (id: number) => {
    setBroadcastError(null);
    setBroadcastSuccess(null);
    try {
      await cancelBroadcast(id);
      setBroadcastSuccess(`Рассылка #${id} отменена.`);
      await fetchBroadcastData();
    } catch (error: any) {
      console.error('Error cancelling broadcast:', error);
      setBroadcastError(error?.response?.data?.error || 'Ошибка при отмене рассылки');
    }
  };

  const statCards = [
    { title: 'Всего пользователей', value: stats.totalUsers, icon: Users, color: '#667eea' },
    { title: 'Активные подписки', value: stats.activeSubscriptions, icon: CreditCard, color: '#f093fb' },
    { title: 'Записей в дневнике', value: stats.totalDiaryEntries, icon: BookOpen, color: '#4facfe' },
    { title: 'Пользователей с дневником', value: stats.usersWithDiary, icon: TrendingUp, color: '#43e97b' },
  ];

  if (loading) {
    return <div className="loading">Загрузка статистики...</div>;
  }

  return (
    <div className="dashboard">
      <h1>Дашборд</h1>

      <div className="stats-grid">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: card.color }}>
                <Icon size={28} color="white" />
              </div>
              <div className="stat-content">
                <h3>{card.title}</h3>
                <p className="stat-value">{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="dashboard-broadcast">
        <div className="dashboard-broadcast-header">
          <h2>Рассылка</h2>
          <button className="broadcast-refresh" onClick={fetchBroadcastData} type="button">
            Обновить
          </button>
        </div>

        <div className="broadcast-grid">
          <div className="broadcast-form">
            <div className="broadcast-row">
              <label>Аудитория</label>
              <select value={broadcastAudience} onChange={(e) => setBroadcastAudience(e.target.value as Audience)}>
                <option value="all">
                  {audienceLabel.all}
                  {broadcastStats ? ` (${broadcastStats.all})` : ''}
                </option>
                <option value="intro_not_completed">
                  {audienceLabel.intro_not_completed}
                  {broadcastStats ? ` (${broadcastStats.intro_not_completed})` : ''}
                </option>
                <option value="paid_active">
                  {audienceLabel.paid_active}
                  {broadcastStats ? ` (${broadcastStats.paid_active})` : ''}
                </option>
                <option value="no_paid_active">
                  {audienceLabel.no_paid_active}
                  {broadcastStats ? ` (${broadcastStats.no_paid_active})` : ''}
                </option>
              </select>
            </div>

            <div className="broadcast-row">
              <label>Формат</label>
              <select
                value={broadcastParseMode === null ? 'PLAIN' : broadcastParseMode}
                onChange={(e) => setBroadcastParseMode(e.target.value === 'PLAIN' ? null : (e.target.value as ParseMode))}
              >
                <option value="MarkdownV2">MarkdownV2</option>
                <option value="PLAIN">Обычный текст</option>
              </select>
            </div>

            <div className="broadcast-row">
              <label>Текст</label>
              {broadcastParseMode === 'MarkdownV2' ? (
                <>
                  <div className="broadcast-toolbar">
                    <button type="button" className="broadcast-tool" title="Жирный *текст*" onClick={() => applyWrap('*', '*', 'жирный')}>
                      <b>Ж</b>
                    </button>
                    <button type="button" className="broadcast-tool" title="Курсив _текст_" onClick={() => applyWrap('_', '_', 'курсив')}>
                      <i>К</i>
                    </button>
                    <button type="button" className="broadcast-tool" title="Подчёркнутый __текст__" onClick={() => applyWrap('__', '__', 'подчёркнутый')}>
                      <u>П</u>
                    </button>
                    <button type="button" className="broadcast-tool" title="Зачёркнутый ~текст~" onClick={() => applyWrap('~', '~', 'зачёркнутый')}>
                      <s>З</s>
                    </button>
                    <button type="button" className="broadcast-tool" title="Код `текст`" onClick={() => applyWrap('`', '`', 'код')}>
                      {'</>'}
                    </button>
                    <button type="button" className="broadcast-tool" title="Блок кода ```текст```" onClick={() => applyWrap('```\n', '\n```', 'код')}>
                      pre
                    </button>
                    <button type="button" className="broadcast-tool" title="Спойлер ||текст||" onClick={() => applyWrap('||', '||', 'спойлер')}>
                      👁
                    </button>
                    <button type="button" className="broadcast-tool" title="Ссылка [текст](url)" onClick={applyLink}>
                      🔗
                    </button>
                    <button type="button" className="broadcast-tool danger" title="Убрать форматирование" onClick={stripFormatting}>
                      ✕
                    </button>
                  </div>
                  <div className="broadcast-hint">
                    MarkdownV2: <code>*жирный*</code> <code>_курсив_</code> <code>__подчёркнутый__</code> <code>~зачёркнутый~</code> <code>`код`</code> <code>||спойлер||</code> <code>[текст](url)</code>
                  </div>
                </>
              ) : null}
              <textarea
                ref={broadcastTextareaRef}
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                rows={10}
                placeholder={
                  broadcastParseMode === 'MarkdownV2'
                    ? 'Введите текст рассылки...\n\n*жирный* _курсив_ __подчёркнутый__ ~зачёркнутый~ `код` ||спойлер|| [ссылка](https://example.com)'
                    : 'Введите текст рассылки...'
                }
              />
            </div>

            <div className="broadcast-actions">
              <button className="broadcast-send" onClick={onCreateBroadcast} disabled={broadcastSending} type="button">
                {broadcastSending ? 'Создаём…' : 'Создать рассылку'}
              </button>
            </div>

            {broadcastError ? <div className="broadcast-error">{broadcastError}</div> : null}
            {broadcastSuccess ? <div className="broadcast-success">{broadcastSuccess}</div> : null}
            {broadcastStats ? (
              <div className="broadcast-hint">Актуальность счётчиков: {new Date(broadcastStats.updatedAt).toLocaleString()}</div>
            ) : null}
          </div>

          <div className="broadcast-list">
            <h3>Последние рассылки</h3>
            {broadcasts.length === 0 ? (
              <div className="broadcast-empty">Пока нет рассылок</div>
            ) : (
              <div className="broadcast-items">
                {broadcasts.map((b) => (
                  <div key={b.id} className="broadcast-item">
                    <div className="broadcast-item-main">
                      <div className="broadcast-item-title">
                        <strong>#{b.id}</strong> • {audienceLabel[b.audience]} • <span className="broadcast-status">{b.status}</span>
                      </div>
                      <div className="broadcast-item-meta">
                        Прогресс: {b.sentCount}/{b.totalTargets} • Ошибки: {b.failedCount}
                      </div>
                      <div className="broadcast-item-meta">Создана: {new Date(b.createdAt).toLocaleString()}</div>
                      {b.error ? (
                        <div className="broadcast-item-error" title={b.error}>
                          {b.error}
                        </div>
                      ) : null}
                    </div>
                    {b.status === 'pending' || b.status === 'running' ? (
                      <button className="broadcast-cancel" onClick={() => onCancelBroadcast(b.id)} type="button">
                        Отменить
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-info">
        <h2>Добро пожаловать в админ-панель!</h2>
        <p>Здесь вы можете управлять пользователями, подписками, сообщениями бота и настройками.</p>
      </div>
    </div>
  );
};

export default Dashboard;
