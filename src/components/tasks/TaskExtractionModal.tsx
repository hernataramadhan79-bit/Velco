import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { StructuredTaskItem } from '../../services/ai/taskExtractor';
import { PriorityLevel } from '../../types/item';

interface TaskExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: StructuredTaskItem[];
  sourceTitle?: string;
  onConfirm: (tasksToCreate: StructuredTaskItem[]) => Promise<void>;
  isLoading?: boolean;
}

export const TaskExtractionModal: React.FC<TaskExtractionModalProps> = ({
  isOpen,
  onClose,
  tasks: initialTasks,
  sourceTitle = 'Context',
  onConfirm,
  isLoading = false,
}) => {
  const [tasks, setTasks] = useState<StructuredTaskItem[]>(initialTasks);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state when initialTasks changes
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const selectedCount = tasks.filter((t) => t.selected).length;

  const handleToggle = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleTitleChange = (id: string, newTitle: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title: newTitle } : t))
    );
  };

  const handlePriorityChange = (id: string, priority: PriorityLevel) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, priority } : t))
    );
  };

  const handleDueDateChange = (id: string, dueDate: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, dueDate: dueDate || null } : t))
    );
  };

  const handleRemove = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleToggleAll = () => {
    const allSelected = tasks.every((t) => t.selected);
    setTasks((prev) => prev.map((t) => ({ ...t, selected: !allSelected })));
  };

  const handleAddNewTask = () => {
    const newTask: StructuredTaskItem = {
      id: crypto.randomUUID(),
      title: '',
      priority: 'medium',
      dueDate: null,
      selected: true,
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const handleSubmit = async () => {
    const tasksToCreate = tasks.filter((t) => t.selected && t.title.trim().length > 0);
    if (tasksToCreate.length === 0) return;

    setIsSubmitting(true);
    try {
      await onConfirm(tasksToCreate);
      onClose();
    } catch (err) {
      console.error('Failed to commit extracted tasks:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const priorityColors: Record<PriorityLevel, string> = {
    urgent: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200 border-rose-300 dark:border-rose-800',
    high: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-200 border-amber-300 dark:border-amber-800',
    medium: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-200 border-blue-300 dark:border-blue-800',
    low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="extraction-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="fixed inset-0"
        onClick={() => !isSubmitting && onClose()}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh] z-10 view-enter">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="extraction-modal-title"
                className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2"
              >
                <span>Structured Task Extraction</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-medium">
                  {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                </span>
              </h2>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
                Analyzed from: <span className="font-semibold text-slate-700 dark:text-slate-300">{sourceTitle}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleAll}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 rounded cursor-pointer"
            >
              {tasks.every((t) => t.selected) ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close modal (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Tasks Review List */}
        <div className="overflow-y-auto p-6 space-y-3 flex-1">
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400">
              No actionable tasks detected. Click "+ Add Task" to create one manually.
            </div>
          ) : (
            tasks.map((task, idx) => {
              return (
                <div
                  key={task.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    task.selected
                      ? 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 shadow-2xs'
                      : 'bg-white/40 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => handleToggle(task.id)}
                      className="mt-0.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer shrink-0"
                    >
                      {task.selected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    {/* Task Content */}
                    <div className="flex-1 min-w-0 space-y-2 select-text">
                      <input
                        type="text"
                        value={task.title}
                        onChange={(e) => handleTitleChange(task.id, e.target.value)}
                        placeholder="Task title..."
                        className="w-full text-xs font-semibold bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/50 rounded px-1.5 py-0.5"
                      />

                      {task.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1.5 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      {/* Controls Row: Priority Pills + Due Date */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 px-1">
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="text-slate-400 mr-0.5">Priority:</span>
                          {(['low', 'medium', 'high', 'urgent'] as PriorityLevel[]).map((p) => {
                            const isCurrent = task.priority === p;
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => handlePriorityChange(task.id, p)}
                                className={`px-2 py-0.5 rounded capitalize transition-all cursor-pointer border ${
                                  isCurrent
                                    ? priorityColors[p] + ' font-bold'
                                    : 'border-transparent text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                                }`}
                              >
                                {p}
                              </button>
                            );
                          })}
                        </div>

                        {/* Optional Date input */}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <input
                            type="date"
                            value={task.dueDate || ''}
                            onChange={(e) => handleDueDateChange(task.id, e.target.value)}
                            className="bg-transparent text-[11px] font-mono text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleRemove(task.id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                      title="Remove from batch"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          <button
            type="button"
            onClick={handleAddNewTask}
            className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Custom Task to Batch</span>
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className="font-bold text-slate-800 dark:text-slate-200">{selectedCount}</span> of {tasks.length} tasks ready to create
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={selectedCount === 0 || isSubmitting}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-98"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Creating Tasks...' : `Create ${selectedCount} Tasks`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
