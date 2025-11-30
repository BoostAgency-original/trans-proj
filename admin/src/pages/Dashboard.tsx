import { useEffect, useState } from 'react';
import { Users, CreditCard, BookOpen, TrendingUp } from 'lucide-react';
import { getUsers, getSubscriptions, getDiaryStats } from '../api/api';
import './Dashboard.css';

interface Stats {
  totalUsers: number;
  activeSubscriptions: number;
  totalDiaryEntries: number;
  usersWithDiary: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeSubscriptions: 0,
    totalDiaryEntries: 0,
    usersWithDiary: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [usersRes, subsRes, diaryRes] = await Promise.all([
        getUsers(),
        getSubscriptions(),
        getDiaryStats(),
      ]);

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

  const statCards = [
    {
      title: 'Всего пользователей',
      value: stats.totalUsers,
      icon: Users,
      color: '#667eea',
    },
    {
      title: 'Активные подписки',
      value: stats.activeSubscriptions,
      icon: CreditCard,
      color: '#f093fb',
    },
    {
      title: 'Записей в дневнике',
      value: stats.totalDiaryEntries,
      icon: BookOpen,
      color: '#4facfe',
    },
    {
      title: 'Пользователей с дневником',
      value: stats.usersWithDiary,
      icon: TrendingUp,
      color: '#43e97b',
    },
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
      <div className="dashboard-info">
        <h2>Добро пожаловать в админ-панель!</h2>
        <p>Здесь вы можете управлять пользователями, подписками, сообщениями бота и настройками.</p>
      </div>
    </div>
  );
};

export default Dashboard;

