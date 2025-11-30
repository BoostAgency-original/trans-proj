import { useEffect, useState } from 'react';
import { getSettings, createOrUpdateSetting, deleteSetting } from '../api/api';
import { Trash2, Edit2, Plus } from 'lucide-react';
import './Settings.css';

interface Setting {
  id: number;
  key: string;
  value: string;
  description?: string;
}

const Settings = () => {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSetting, setEditingSetting] = useState<Setting | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await getSettings();
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (setting: Partial<Setting>) => {
    try {
      await createOrUpdateSetting(setting);
      await fetchSettings();
      setEditingSetting(null);
      setIsCreating(false);
    } catch (error) {
      console.error('Error saving setting:', error);
    }
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm('Удалить эту настройку?')) return;
    
    try {
      await deleteSetting(key);
      await fetchSettings();
    } catch (error) {
      console.error('Error deleting setting:', error);
    }
  };

  if (loading) {
    return <div className="loading">Загрузка настроек...</div>;
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1>Настройки системы</h1>
          <p>Управление глобальными настройками</p>
        </div>
        <button onClick={() => setIsCreating(true)} className="btn-primary">
          <Plus size={18} />
          Добавить настройку
        </button>
      </div>

      {(isCreating || editingSetting) && (
        <SettingForm
          setting={editingSetting}
          onSave={handleSave}
          onCancel={() => {
            setEditingSetting(null);
            setIsCreating(false);
          }}
        />
      )}

      <div className="settings-grid">
        {settings.map((setting) => (
          <div key={setting.id} className="setting-card">
            <div className="setting-header">
              <span className="setting-key">{setting.key}</span>
              <div className="setting-actions">
                <button onClick={() => setEditingSetting(setting)} className="btn-icon-small">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(setting.key)} className="btn-icon-small danger">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            {setting.description && <p className="setting-description">{setting.description}</p>}
            <p className="setting-value">{setting.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

interface SettingFormProps {
  setting: Setting | null;
  onSave: (setting: Partial<Setting>) => void;
  onCancel: () => void;
}

const SettingForm = ({ setting, onSave, onCancel }: SettingFormProps) => {
  const [formData, setFormData] = useState({
    key: setting?.key || '',
    value: setting?.value || '',
    description: setting?.description || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="setting-form-overlay">
      <form onSubmit={handleSubmit} className="setting-form">
        <h2>{setting ? 'Редактировать настройку' : 'Новая настройка'}</h2>
        
        <div className="form-group">
          <label>Ключ (key):</label>
          <input
            type="text"
            value={formData.key}
            onChange={(e) => setFormData({ ...formData, key: e.target.value })}
            required
            disabled={!!setting}
          />
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
          <label>Значение:</label>
          <textarea
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            rows={4}
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

export default Settings;

