import { useEffect, useState } from 'react';
import { getMessages, createOrUpdateMessage, deleteMessage } from '../api/api';
import { Trash2, Edit2, Plus } from 'lucide-react';
import './Messages.css';

interface BotMessage {
  id: number;
  key: string;
  text: string;
  category: string;
  description?: string;
}

const Messages = () => {
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMessage, setEditingMessage] = useState<BotMessage | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const response = await getMessages();
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (message: Partial<BotMessage>) => {
    try {
      await createOrUpdateMessage(message);
      await fetchMessages();
      setEditingMessage(null);
      setIsCreating(false);
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm('Удалить это сообщение?')) return;
    
    try {
      await deleteMessage(key);
      await fetchMessages();
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  if (loading) {
    return <div className="loading">Загрузка сообщений...</div>;
  }

  return (
    <div className="messages-page">
      <div className="page-header">
        <div>
          <h1>Сообщения бота</h1>
          <p>Управление репликами бота</p>
        </div>
        <button onClick={() => setIsCreating(true)} className="btn-primary">
          <Plus size={18} />
          Добавить сообщение
        </button>
      </div>

      {(isCreating || editingMessage) && (
        <MessageForm
          message={editingMessage}
          onSave={handleSave}
          onCancel={() => {
            setEditingMessage(null);
            setIsCreating(false);
          }}
        />
      )}

      <div className="messages-list">
        {messages.map((msg) => (
          <div key={msg.id} className="message-card">
            <div className="message-header">
              <div>
                <span className="message-key">{msg.key}</span>
                <span className="message-category">{msg.category}</span>
              </div>
              <div className="message-actions">
                <button onClick={() => setEditingMessage(msg)} className="btn-icon-small">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(msg.key)} className="btn-icon-small danger">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            {msg.description && <p className="message-description">{msg.description}</p>}
            <p className="message-text">{msg.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

interface MessageFormProps {
  message: BotMessage | null;
  onSave: (message: Partial<BotMessage>) => void;
  onCancel: () => void;
}

const MessageForm = ({ message, onSave, onCancel }: MessageFormProps) => {
  const [formData, setFormData] = useState({
    key: message?.key || '',
    text: message?.text || '',
    category: message?.category || 'general',
    description: message?.description || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="message-form-overlay">
      <form onSubmit={handleSubmit} className="message-form">
        <h2>{message ? 'Редактировать сообщение' : 'Новое сообщение'}</h2>
        
        <div className="form-group">
          <label>Ключ (key):</label>
          <input
            type="text"
            value={formData.key}
            onChange={(e) => setFormData({ ...formData, key: e.target.value })}
            required
            disabled={!!message}
          />
        </div>

        <div className="form-group">
          <label>Категория:</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          >
            <option value="general">Общие</option>
            <option value="menu">Меню</option>
            <option value="introduction">Вводный сценарий</option>
            <option value="daily">Ежедневные</option>
            <option value="subscription">Подписка</option>
          </select>
        </div>

        <div className="form-group">
          <label>Описание:</label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label>Текст сообщения:</label>
          <textarea
            value={formData.text}
            onChange={(e) => setFormData({ ...formData, text: e.target.value })}
            rows={6}
            required
          />
        </div>

        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Отмена
          </button>
          <button type="submit" className="btn-primary">
            Сохранить
          </button>
        </div>
      </form>
    </div>
  );
};

export default Messages;

