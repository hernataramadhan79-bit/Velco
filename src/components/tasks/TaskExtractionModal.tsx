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
    low: 'bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-zinc-300 border-slate-300 dark:border-white/[0.08]',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="extraction-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150 select-none"
    >
      <div
        className="fixed inset-0"
        onClick={() => !isSubmitting && onClose()}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#141418] rounded-xl shadow-2xl border border-slate-200 dark:border-white/[0.1] overflow-hidden flex flex-col max-h-[85vh] z-10 text-slate-900 dark:text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/[0.07] bg-slate-50 dark:bg-[#101014]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2
                id="extraction-modal-title"
                className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-900 dark:text-zinc-100 flex items-center gap-2"
              >
                <span>Task Extraction</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                </span>
              </h2>
              <div className="text-[11px] text-slate-500 dark:text-zinc-500 truncate max-w-md font-mono">
                Source: <span className="text-slate-700 dark:text-zinc-300">{sourceTitle}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleAll}
              className="text-[11px] font-mono text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 rounded cursor-pointer"
            >
              {tasks.every((t) => t.selected) ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
              title="Close modal (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Scrollable Tasks Review List */}
        <div className="overflow-y-auto overflow-x-hidden p-4 space-y-2.5 flex-1">
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-xs font-mono text-slate-400 dark:text-zinc-500">
              No actionable tasks detected. Click "+ Add Task" to create one manually.
            </div>
          ) : (
            tasks.map((task) => {
              return (
                <div
                  key={task.id}
                  className={`p-3 rounded-lg border transition-all ${
                    task.selected
                      ? 'bg-slate-50 dark:bg-[#101014] border-slate-200 dark:border-white/[0.08] shadow-2xs'
                      : 'bg-slate-50/40 dark:bg-white/[0.01] border-slate-200/50 dark:border-white/[0.03] opacity-50'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
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
                    <div className="flex-1 min-w-0 space-y-1.5 select-text">
                      <input
                        type="text"
                        value={task.title}
                        onChange={(e) => handleTitleChange(task.id, e.target.value)}
                        placeholder="Task title..."
                        className="w-full text-xs font-medium bg-transparent text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 rounded px-1 py-0.5 border border-transparent"
                      />

                      {task.description && (
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 px-1 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      {/* Controls Row: Priority Pills + Due Date */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 px-1">
                        <div className="flex items-center gap-1 text-[10px] font-mono">
                          <span className="text-slate-400 dark:text-zinc-500 mr-0.5 uppercase">Priority:</span>
                          {(['low', 'medium', 'high', 'urgent'] as PriorityLevel[]).map((p) => {
                            const isCurrent = task.priority === p;
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => handlePriorityChange(task.id, p)}
                                className={`px-1.5 py-0.2 rounded uppercase font-semibold transition-all cursor-pointer border ${
                                  isCurrent
                                    ? 'bg-blue-600 text-white border-blue-500 shadow-2xs'
                                    : 'border-slate-200/60 dark:border-white/[0.04] text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                                }`}
                              >
                                {p}
                              </button>
                            );
                          })}
                        </div>

                        {/* Optional Date input */}
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                          <Calendar className="w-3 h-3 shrink-0" />
                          <input
                            type="date"
                            value={task.dueDate || ''}
                            onChange={(e) => handleDueDateChange(task.id, e.target.value)}
                            className="bg-transparent text-[10px] font-mono text-slate-700 dark:text-zinc-300 focus:outline-none cursor-pointer border-b border-transparent hover:border-slate-300 dark:hover:border-zinc-700"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleRemove(task.id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer shrink-0"
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
            className="w-full py-2 rounded-lg border border-dashed border-slate-300 dark:border-white/[0.08] hover:border-slate-400 dark:hover:border-white/[0.16] text-xs font-mono text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add Custom Task to Batch</span>
          </button>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-[#101014] border-t border-slate-200 dark:border-white/[0.07] flex items-center justify-between">
          <div className="text-xs font-mono text-slate-500 dark:text-zinc-500">
            <span className="font-semibold text-slate-900 dark:text-zinc-200">{selectedCount}</span> of {tasks.length} tasks ready
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.2 rounded-md text-xs font-mono text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={selectedCount === 0 || isSubmitting}
              className="px-3.5 py-1.2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-mono font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-98"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Creating...' : `Create (${selectedCount}) Tasks`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
