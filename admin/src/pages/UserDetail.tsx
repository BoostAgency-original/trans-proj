import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUser, updateSubscription } from '../api/api';
import { ArrowLeft, Gift } from 'lucide-react';
import './UserDetail.css';

interface User {
  id: number;
  telegramId: bigint;
  username?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  gender?: string;
  isIntroCompleted: boolean;
  timezone: string;
  skippedDays: number; // Добавлено поле
  createdAt: string;
  subscription?: {
    isActive: boolean;
    activatedAt?: string;
    expiresAt?: string;
    trialDaysUsed: number;
  };
  weeklyAnalytics?: Array<{
    id: number;
    weekNumber: number;
    dayNumber: number;
    notesDays: number;
    notesCount: number;
    text: string;
    createdAt: string;
  }>;
  diaryEntries: Array<{
    id: number;
    dayNumber: number; // Используем dayNumber вместо principle
    type: string; // morning/evening
    note: string;
    createdAt: string;
  }>;
}

const UserDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantDays, setGrantDays] = useState(30);
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchUser(parseInt(id));
    }
  }, [id]);

  const fetchUser = async (userId: number) => {
    try {
      const response = await getUser(userId);
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGrantSubscription = async () => {
    if (!user) return;
    
    setGranting(true);
    try {
      const currentExpiresAt = user.subscription?.expiresAt && new Date(user.subscription.expiresAt) > new Date()
        ? new Date(user.subscription.expiresAt)
        : new Date();
      
      const newExpiresAt = new Date(currentExpiresAt);
      newExpiresAt.setDate(newExpiresAt.getDate() + grantDays);
      
      await updateSubscription(user.id, {
        isActive: true,
        expiresAt: newExpiresAt.toISOString()
      });
      
      // Перезагружаем данные пользователя
      await fetchUser(user.id);
      setShowGrantModal(false);
      alert(`Подписка выдана на ${grantDays} дней!`);
    } catch (error) {
      console.error('Error granting subscription:', error);
      alert('Ошибка при выдаче подписки');
    } finally {
      setGranting(false);
    }
  };

  if (loading) {
    return <div className="loading">Загрузка данных пользователя...</div>;
  }

  if (!user) {
    return <div className="error">Пользователь не найден</div>;
  }

  const genderLabel = user.gender === 'male' ? 'Мужской' : user.gender === 'female' ? 'Женский' : 'Не указан';

  return (
    <div className="user-detail">
      <button onClick={() => navigate('/users')} className="back-button">
        <ArrowLeft size={20} />
        Назад к списку
      </button>

      <div className="detail-card">
        <h1>Информация о пользователе</h1>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">ID:</span>
            <span className="info-value">{user.id}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Telegram ID:</span>
            <span className="info-value">{user.telegramId.toString()}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Имя (Telegram):</span>
            <span className="info-value">{user.firstName || '-'} {user.lastName || ''}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Имя (в боте):</span>
            <span className="info-value">{user.name || '-'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Пол:</span>
            <span className="info-value">{genderLabel}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Username:</span>
            <span className="info-value">{user.username ? `@${user.username}` : '-'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Вводный курс:</span>
            <span className={`badge ${user.isIntroCompleted ? 'active' : 'inactive'}`}>
              {user.isIntroCompleted ? 'Пройден' : 'Не пройден'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Временная зона:</span>
            <span className="info-value">{user.timezone}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Пропущено дней:</span>
            <span className="info-value">{user.skippedDays || 0}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Дата регистрации:</span>
            <span className="info-value">
              {new Date(user.createdAt).toLocaleString('ru-RU')}
            </span>
          </div>
        </div>
      </div>

      <div className="detail-card">
        <div className="card-header">
        <h2>Подписка</h2>
          <button className="grant-btn" onClick={() => setShowGrantModal(true)}>
            <Gift size={16} />
            Выдать подписку
          </button>
        </div>
        {user.subscription ? (
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Статус:</span>
              <span className={`badge ${user.subscription.isActive ? 'active' : 'inactive'}`}>
                {user.subscription.isActive ? 'Активна' : 'Неактивна'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Использовано триал-дней:</span>
              <span className="info-value">{user.subscription.trialDaysUsed}/7</span>
            </div>
            {user.subscription.activatedAt && (
              <div className="info-item">
                <span className="info-label">Активирована:</span>
                <span className="info-value">
                  {new Date(user.subscription.activatedAt).toLocaleString('ru-RU')}
                </span>
              </div>
            )}
            {user.subscription.expiresAt && (
              <div className="info-item">
                <span className="info-label">Истекает:</span>
                <span className="info-value">
                  {new Date(user.subscription.expiresAt).toLocaleString('ru-RU')}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p>Нет данных о подписке</p>
        )}
      </div>

      {/* Модальное окно выдачи подписки */}
      {showGrantModal && (
        <div className="modal-overlay" onClick={() => setShowGrantModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Выдать подписку</h3>
            <p>Выберите срок подписки для пользователя {user.name || user.firstName || 'ID: ' + user.id}</p>
            
            <div className="grant-options">
              <label>
                <input
                  type="radio"
                  value={7}
                  checked={grantDays === 7}
                  onChange={() => setGrantDays(7)}
                />
                7 дней
              </label>
              <label>
                <input
                  type="radio"
                  value={30}
                  checked={grantDays === 30}
                  onChange={() => setGrantDays(30)}
                />
                30 дней
              </label>
              <label>
                <input
                  type="radio"
                  value={80}
                  checked={grantDays === 80}
                  onChange={() => setGrantDays(80)}
                />
                80 дней
              </label>
              <label>
                <input
                  type="radio"
                  value={365}
                  checked={grantDays === 365}
                  onChange={() => setGrantDays(365)}
                />
                1 год
              </label>
            </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowGrantModal(false)}>
                Отмена
              </button>
              <button 
                className="confirm-btn" 
                onClick={handleGrantSubscription}
                disabled={granting}
              >
                {granting ? 'Выдача...' : 'Выдать'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="detail-card">
        <h2>Дневник наблюдений ({user.diaryEntries.length})</h2>
        {user.diaryEntries.length > 0 ? (
          <div className="diary-list">
            {user.diaryEntries.map((entry) => (
              <div key={entry.id} className="diary-entry">
                <div className="diary-header">
                  <span className="principle-badge">День {entry.dayNumber} ({entry.type === 'morning' ? 'Утро' : entry.type === 'evening' ? 'Вечер' : 'Общее'})</span>
                  <span className="diary-date">
                    {new Date(entry.createdAt).toLocaleString('ru-RU')}
                  </span>
                </div>
                <p className="diary-note">{entry.note}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>Пока нет записей в дневнике</p>
        )}
      </div>

      <div className="detail-card">
        <h2>Недельная аналитика ({user.weeklyAnalytics?.length || 0})</h2>
        {user.weeklyAnalytics && user.weeklyAnalytics.length > 0 ? (
          <div className="diary-list">
            {user.weeklyAnalytics.map((a) => (
              <div key={a.id} className="diary-entry">
                <div className="diary-header">
                  <span className="principle-badge">Неделя {a.weekNumber} • День {a.dayNumber}</span>
                  <span className="diary-date">{new Date(a.createdAt).toLocaleString('ru-RU')}</span>
                </div>
                <p className="diary-note">
                  <b>Заметки:</b> {a.notesDays}/7 дней (всего {a.notesCount})
                </p>
                <p className="diary-note" style={{ whiteSpace: 'pre-wrap' }}>{a.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>Пока нет аналитики</p>
        )}
      </div>
    </div>
  );
};

export default UserDetail;
