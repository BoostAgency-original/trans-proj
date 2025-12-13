import { useEffect, useState } from 'react';
import { getSubscriptions } from '../api/api';
import './Subscriptions.css';

interface Subscription {
  id: number;
  userId: number;
  isActive: boolean;
  activatedAt?: string;
  expiresAt?: string;
  trialDaysUsed: number;
  user: {
    id: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    telegramId: bigint;
  };
}

const Subscriptions = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const response = await getSubscriptions();
      setSubscriptions(response.data);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Загрузка подписок...</div>;
  }

  const activeCount = subscriptions.filter((s) => s.isActive).length;

  return (
    <div className="subscriptions-page">
      <div className="page-header">
        <h1>Подписки</h1>
        <p>
          Активных: {activeCount} из {subscriptions.length}
        </p>
      </div>
      <div className="table-container">
        <table className="subscriptions-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Пользователь</th>
              <th>Telegram ID</th>
              <th>Статус</th>
              <th>Триал-дни</th>
              <th>Активирована</th>
              <th>Истекает</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((sub) => (
              <tr key={sub.id}>
                <td>{sub.id}</td>
                <td>
                  {sub.user.firstName || '-'} {sub.user.lastName || ''}<br />
                  <small>{sub.user.username ? `@${sub.user.username}` : '-'}</small>
                </td>
                <td>{sub.user.telegramId.toString()}</td>
                <td>
                  <span className={`badge ${sub.isActive ? 'active' : 'inactive'}`}>
                    {sub.isActive ? 'Активна' : 'Неактивна'}
                  </span>
                </td>
                <td>{sub.trialDaysUsed}/7</td>
                <td>
                  {sub.activatedAt
                    ? new Date(sub.activatedAt).toLocaleDateString('ru-RU')
                    : '-'}
                </td>
                <td>
                  {sub.expiresAt
                    ? new Date(sub.expiresAt).toLocaleDateString('ru-RU')
                    : 'Бессрочно'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Subscriptions;

