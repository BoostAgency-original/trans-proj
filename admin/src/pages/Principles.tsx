import React, { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Pencil, Trash2, GripVertical, X } from 'lucide-react';
import { getPrinciples, createPrinciple, updatePrinciple, deletePrinciple, reorderPrinciples } from '../api/api';
import './Principles.css';

interface Principle {
  id: number;
  dayNumber: number;
  title: string;
  declaration: string;
  description: string;
  task: string;
}

interface SortableItemProps {
  principle: Principle;
  onEdit: (principle: Principle) => void;
  onDelete: (id: number) => void;
}

function SortableItem({ principle, onEdit, onDelete }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: principle.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="principle-item">
      <div {...attributes} {...listeners} className="principle-drag-handle">
        <GripVertical size={20} />
      </div>
      <div className="principle-content">
        <div className="principle-title">День {principle.dayNumber}: {principle.title}</div>
        <div className="principle-preview">{principle.declaration}</div>
      </div>
      <div className="principle-actions">
        <button className="action-btn edit" onClick={() => onEdit(principle)}>
          <Pencil size={18} />
        </button>
        <button className="action-btn delete" onClick={() => onDelete(principle.id)}>
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}

export default function Principles() {
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrinciple, setEditingPrinciple] = useState<Principle | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    declaration: '',
    description: '',
    task: ''
  });

  const fetchPrinciples = async () => {
    try {
      const response = await getPrinciples();
      setPrinciples(response.data);
    } catch (error) {
      console.error('Error fetching principles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrinciples();
  }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setPrinciples((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Отправляем новый порядок на сервер
        const ids = newItems.map(item => item.id);
        reorderPrinciples(ids).catch(err => {
            console.error('Error reordering:', err);
            // В случае ошибки можно вернуть старый порядок, но пока просто логируем
        });

        // Локально обновляем dayNumber для отображения
        return newItems.map((item, index) => ({
            ...item,
            dayNumber: index + 1
        }));
      });
    }
  };

  const handleAddClick = () => {
    setEditingPrinciple(null);
    setFormData({ title: '', declaration: '', description: '', task: '' });
    setIsModalOpen(true);
  };

  const handleEditClick = (principle: Principle) => {
    setEditingPrinciple(principle);
    setFormData({
      title: principle.title,
      declaration: principle.declaration,
      description: principle.description,
      task: principle.task
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: number) => {
    if (window.confirm('Вы уверены, что хотите удалить этот принцип?')) {
      try {
        await deletePrinciple(id);
        fetchPrinciples();
      } catch (error) {
        console.error('Error deleting principle:', error);
        alert('Ошибка при удалении');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPrinciple) {
        await updatePrinciple(editingPrinciple.id, formData);
      } else {
        await createPrinciple(formData);
      }
      setIsModalOpen(false);
      fetchPrinciples();
    } catch (error) {
      console.error('Error saving principle:', error);
      alert('Ошибка при сохранении');
    }
  };

  return (
    <div className="principles-container">
      <div className="principles-header">
        <h2>Принципы Трансерфинга ({principles.length})</h2>
        <button className="add-principle-btn" onClick={handleAddClick}>
          <Plus size={20} />
          Добавить принцип
        </button>
      </div>

      {isLoading ? (
        <div>Загрузка...</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={principles.map(p => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="principles-list">
              {principles.map((principle) => (
                <SortableItem
                  key={principle.id}
                  principle={principle}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingPrinciple ? 'Редактировать принцип' : 'Новый принцип'}</h3>
              <button className="action-btn" onClick={() => setIsModalOpen(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Название</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Декларация</label>
                <textarea
                  value={formData.declaration}
                  onChange={(e) => setFormData({ ...formData, declaration: e.target.value })}
                  required
                  placeholder="Короткая цитата или утверждение..."
                />
              </div>
              <div className="form-group">
                <label>Пояснение</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  placeholder="Основной текст принципа..."
                  style={{ minHeight: '150px' }}
                />
              </div>
              <div className="form-group">
                <label>Задание на день</label>
                <textarea
                  value={formData.task}
                  onChange={(e) => setFormData({ ...formData, task: e.target.value })}
                  required
                  placeholder="Что нужно сделать или наблюдать..."
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn-save">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

