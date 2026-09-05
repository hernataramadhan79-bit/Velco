import React, { useState } from 'react';
import { Item, CreateItemInput, PriorityLevel } from '../../types/item';
import { ItemCard } from '../../components/items/ItemCard';
import { Plus, CheckSquare } from 'lucide-react';

interface TasksViewProps {
  tasks: Item[];
  onCapture: (input: CreateItemInput) => Promise<any>;
  onSelect: (item: Item) => void;
  onToggleTask: (itemId: string, completed: boolean) => void;
  onToggleFavorite: (itemId: string) => void;
  onTrash: (itemId: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  onCapture,
  onSelect,
  onToggleTask,
  onToggleFavorite,
  onTrash,
}) => {
  const [taskText, setTaskText] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [dueDate, setDueDate] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskText.trim()) return;

    await onCapture({
      type: 'task',
      title: taskText.trim(),
      task: {
        priority,
        completed: false,
        dueDate: dueDate || null,
      },
    });

    setTaskText('');
    setDueDate('');
  };

  const filteredTasks = tasks.filter((t) => {
    const isCompleted = !!t.task?.completed;
    if (filter === 'pending') return !isCompleted;
    if (filter === 'completed') return isCompleted;
    return true;
  });

  const pendingCount = tasks.filter((t) => !t.task?.completed).length;
  const completedCount = tasks.filter((t) => t.task?.completed).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Quick Task Capture */}
      <form
        onSubmit={handleQuickAdd}
        className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5"
      >
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
          <input
            type="text"
            value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
            placeholder="Add a new task..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!taskText.trim()}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
        </div>

        <div className="flex items-center gap-2 px-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <span className="text-slate-400">Priority:</span>
          {(['low', 'medium', 'high', 'urgent'] as PriorityLevel[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={`px-2 py-0.5 rounded capitalize font-medium transition-colors cursor-pointer ${
                priority === p
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {p}
            </button>
          ))}
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="ml-auto px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
          />
        </div>
      </form>

      {/* Task Filters */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs">
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
              filter === 'pending'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
              filter === 'completed'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Completed ({completedCount})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            All ({tasks.length})
          </button>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-2.5">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-16 text-xs text-slate-400">
            No tasks found in this view.
          </div>
        ) : (
          filteredTasks.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onSelect={onSelect}
              onToggleTask={onToggleTask}
              onToggleFavorite={onToggleFavorite}
              onTrash={onTrash}
            />
          ))
        )}
      </div>
    </div>
  );
};
