import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getUsers } from '../api/api';
import { Eye } from 'lucide-react';
import './Users.css';

interface User {
  id: number;
  telegramId: bigint;
  username?: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  subscription?: {
    isActive: boolean;
  };
  _count: {
    diaryEntries: number;
  };
}

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Загрузка пользователей...</div>;
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>Пользователи</h1>
        <p>Всего пользователей: {users.length}</p>
      </div>
      <div className="table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Имя</th>
              <th>Username</th>
              <th>Telegram ID</th>
              <th>Подписка</th>
              <th>Заметок</th>
              <th>Дата регистрации</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.firstName || '-'} {user.lastName || ''}</td>
                <td>{user.username ? `@${user.username}` : '-'}</td>
                <td>{user.telegramId.toString()}</td>
                <td>
                  <span className={`badge ${user.subscription?.isActive ? 'active' : 'inactive'}`}>
                    {user.subscription?.isActive ? 'Активна' : 'Неактивна'}
                  </span>
                </td>
                <td>{user._count.diaryEntries}</td>
                <td>{new Date(user.createdAt).toLocaleDateString('ru-RU')}</td>
                <td>
                  <Link to={`/users/${user.id}`} className="btn-icon">
                    <Eye size={18} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Users;

