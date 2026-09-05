import React, { useState } from 'react';
import { Item, CreateItemInput, PriorityLevel } from '../../types/item';
import { ItemCard } from '../../components/items/ItemCard';
import { Plus, CheckSquare } from 'lucide-react';
import { DueDatePicker } from '../../components/tasks/DueDatePicker';
import { isTaskDueToday, isTaskOverdue } from '../../utils/dateUtils';

interface TasksViewProps {
  tasks: Item[];
  onCapture: (input: CreateItemInput) => Promise<any>;
  onSelect: (item: Item) => void;
  onToggleTask: (itemId: string, completed: boolean) => void;
  onToggleFavorite: (itemId: string) => void;
  onTrash: (itemId: string) => void;
}

type TaskFilter = 'pending' | 'due_today' | 'overdue' | 'completed' | 'all';

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
  const [filter, setFilter] = useState<TaskFilter>('pending');

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

  const pendingCount = tasks.filter((t) => !t.task?.completed).length;
  const dueTodayCount = tasks.filter((t) => !t.task?.completed && isTaskDueToday(t.task?.dueDate)).length;
  const overdueCount = tasks.filter((t) => !t.task?.completed && isTaskOverdue(t.task?.dueDate)).length;
  const completedCount = tasks.filter((t) => !!t.task?.completed).length;

  const filteredTasks = tasks.filter((t) => {
    const isCompleted = !!t.task?.completed;
    if (filter === 'pending') return !isCompleted;
    if (filter === 'due_today') return !isCompleted && isTaskDueToday(t.task?.dueDate);
    if (filter === 'overdue') return !isCompleted && isTaskOverdue(t.task?.dueDate);
    if (filter === 'completed') return isCompleted;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Quick Task Capture with Balanced Layout */}
      <form
        onSubmit={handleQuickAdd}
        className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
      >
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-slate-400 shrink-0 ml-1.5" />
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
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1 shrink-0 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
        </div>

        {/* Priority Pills (Left) & Due Date Picker (Right) */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px] font-medium mr-1">Priority:</span>
            {(['low', 'medium', 'high', 'urgent'] as PriorityLevel[]).map((p) => {
              const active = priority === p;
              const colorClass =
                p === 'urgent'
                  ? active
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200 border-rose-300 dark:border-rose-800 font-semibold'
                    : 'text-rose-600/70 dark:text-rose-400/70 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                  : p === 'high'
                  ? active
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-200 border-amber-300 dark:border-amber-800 font-semibold'
                    : 'text-amber-600/70 dark:text-amber-400/70 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                  : p === 'medium'
                  ? active
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-200 border-blue-300 dark:border-blue-800 font-semibold'
                    : 'text-blue-600/70 dark:text-blue-400/70 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                  : active
                  ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 font-semibold'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/60';

              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`px-2 py-0.5 rounded-md capitalize text-[11px] border border-transparent transition-all cursor-pointer ${colorClass}`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <DueDatePicker value={dueDate} onChange={setDueDate} />
        </div>
      </form>

      {/* Task Filters Segmented Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl text-xs border border-slate-200/80 dark:border-slate-800">
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              filter === 'pending'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Pending ({pendingCount})
          </button>

          <button
            onClick={() => setFilter('due_today')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'due_today'
                ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 font-semibold shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>Due Today</span>
            {dueTodayCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                {dueTodayCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setFilter('overdue')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'overdue'
                ? 'bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-200 font-semibold shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>Overdue</span>
            {overdueCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                {overdueCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              filter === 'completed'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Completed ({completedCount})
          </button>

          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
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
            {filter === 'overdue'
              ? 'Great job! No overdue tasks.'
              : filter === 'due_today'
              ? 'No tasks due today.'
              : filter === 'pending'
              ? 'No pending tasks. You are all caught up!'
              : 'No tasks found in this view.'}
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
