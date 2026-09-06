import React, { useState, useMemo } from 'react';
import { Item, CreateItemInput, PriorityLevel, parseTaskBatchSource, TaskBatchSource } from '../../types/item';
import { ItemCard } from '../../components/items/ItemCard';
import { TaskBatchSection } from '../../components/tasks/TaskBatchSection';
import { Plus, CheckSquare, Bell, CheckCircle2 } from 'lucide-react';
import { DueDatePicker } from '../../components/tasks/DueDatePicker';
import { isTaskDueToday, isTaskOverdue } from '../../utils/dateUtils';
import { reminderService } from '../../services/reminder/reminderService';
import { EmptyState } from '../../components/common/EmptyState';

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
  const [isTesting, setIsTesting] = useState(false);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  const handleQuickTestNotification = async () => {
    setIsTesting(true);
    setTestFeedback(null);
    try {
      const res = await reminderService.testNotification(
        'Velco Task Reminder',
        'System notification & audio reminder chime active!'
      );
      if (res.granted) {
        setTestFeedback('Sent (OS & Audio)');
      } else {
        setTestFeedback('Sent (In-App & Audio)');
      }
    } catch {
      setTestFeedback('Test Failed');
    } finally {
      setIsTesting(false);
      setTimeout(() => setTestFeedback(null), 4000);
    }
  };

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

  // Group filtered tasks into multi-task AI batches and clean standalone tasks
  const { batchGroups, standaloneTasks } = useMemo(() => {
    const rawBatchMap = new Map<string, { meta: TaskBatchSource; tasks: Item[] }>();
    const standalone: Item[] = [];

    for (const task of filteredTasks) {
      const parsed = parseTaskBatchSource(task.source);
      if (parsed && parsed.batchId) {
        const existing = rawBatchMap.get(parsed.batchId);
        if (existing) {
          existing.tasks.push(task);
        } else {
          rawBatchMap.set(parsed.batchId, { meta: parsed, tasks: [task] });
        }
      } else {
        standalone.push(task);
      }
    }

    // Only promote to a Batch Section if the batch has >= 2 tasks
    // If only 1 task was generated or exists, keep it in standalone to avoid visual noise/clutter!
    const batches: { meta: TaskBatchSource; tasks: Item[] }[] = [];

    rawBatchMap.forEach((group) => {
      if (group.tasks.length >= 2) {
        batches.push(group);
      } else {
        standalone.push(...group.tasks);
      }
    });

    return {
      batchGroups: batches,
      standaloneTasks: standalone,
    };
  }, [filteredTasks]);

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

        {/* Diagnostic Test Button */}
        <button
          type="button"
          onClick={handleQuickTestNotification}
          disabled={isTesting}
          className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-indigo-50 dark:bg-slate-900/80 dark:hover:bg-indigo-950/60 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
          title="Uji coba banner notifikasi Windows, nada bel, dan notifikasi in-app"
        >
          {testFeedback ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Bell className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          )}
          <span>{isTesting ? 'Menguji...' : testFeedback || 'Tes Notifikasi & Audio'}</span>
        </button>
      </div>

      {/* Tasks List (Grouped by Batches + Standalone) */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <EmptyState
            icon={filter === 'overdue' || filter === 'pending' ? CheckCircle2 : CheckSquare}
            title={
              filter === 'overdue'
                ? 'Great job! No overdue tasks'
                : filter === 'due_today'
                ? 'No tasks due today'
                : filter === 'pending'
                ? 'You are all caught up!'
                : filter === 'completed'
                ? 'No completed tasks yet'
                : 'No tasks found'
            }
            description={
              filter === 'overdue'
                ? 'Everything is on schedule. Keep up the great pace!'
                : filter === 'due_today'
                ? 'You have no deadlines scheduled for today. Plan ahead or take a break.'
                : filter === 'pending'
                ? 'All pending tasks have been completed. Add a new task above anytime.'
                : filter === 'completed'
                ? 'Check off tasks as you finish them to build momentum.'
                : 'Add a new task using the quick capture bar above to get started.'
            }
            badge={filter === 'overdue' || filter === 'pending' ? '🎉' : '📋'}
          />
        ) : (
          <>
            {/* Render AI Structured Batches */}
            {batchGroups.map((group) => (
              <TaskBatchSection
                key={group.meta.batchId}
                meta={group.meta}
                tasks={group.tasks}
                onSelect={onSelect}
                onToggleTask={onToggleTask}
                onToggleFavorite={onToggleFavorite}
                onTrash={onTrash}
              />
            ))}

            {/* Render Standalone / Direct Tasks */}
            {standaloneTasks.length > 0 && (
              <div className="space-y-2.5">
                {batchGroups.length > 0 && (
                  <div className="flex items-center gap-2 pt-2 px-1">
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Individual Tasks ({standaloneTasks.length})
                    </span>
                    <div className="flex-1 h-px bg-slate-200/70 dark:bg-slate-800" />
                  </div>
                )}
                {standaloneTasks.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onSelect={onSelect}
                    onToggleTask={onToggleTask}
                    onToggleFavorite={onToggleFavorite}
                    onTrash={onTrash}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
