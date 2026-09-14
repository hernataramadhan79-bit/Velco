import React from 'react';
import {
  Plus,
  Calendar,
  X,
} from 'lucide-react';
import { ItemSummary, PriorityLevel } from '../../../types/item';

interface CapsuleKanbanBoardProps {
  tasks: ItemSummary[];
  taskViewMode: 'board' | 'list';
  newTaskTitle: string;
  newTaskPriority: PriorityLevel;
  newTaskDueDate: string;
  onTitleChange: (v: string) => void;
  onPriorityChange: (p: PriorityLevel) => void;
  onDueDateChange: (d: string) => void;
  onAddTask: (e: React.FormEvent) => void;
  onToggleTask: (task: ItemSummary) => void;
  onRemoveItem: (id: string, title: string) => void;
  onSelectItem: (id: string) => void;
}

export const CapsuleKanbanBoard: React.FC<CapsuleKanbanBoardProps> = ({
  tasks,
  taskViewMode,
  newTaskTitle,
  newTaskPriority,
  newTaskDueDate,
  onTitleChange,
  onPriorityChange,
  onDueDateChange,
  onAddTask,
  onToggleTask,
  onRemoveItem,
  onSelectItem,
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 max-w-full overflow-hidden">
      {/* Quick Add Task Bar */}
      <div className="p-4 border-b border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#09090b] shrink-0">
        <form onSubmit={onAddTask} className="flex items-center gap-2 max-w-4xl">
          <input
            type="text"
            placeholder="Add a new task to this capsule..."
            value={newTaskTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-md bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <select
            value={newTaskPriority}
            onChange={(e) => onPriorityChange(e.target.value as PriorityLevel)}
            className="px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-white/[0.08] text-xs font-medium text-slate-700 dark:text-zinc-200 focus:outline-none cursor-pointer"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>

          <input
            type="date"
            value={newTaskDueDate}
            onChange={(e) => onDueDateChange(e.target.value)}
            className="px-2 py-1 rounded-md bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-700 dark:text-zinc-300 focus:outline-none cursor-pointer"
            title="Due Date"
          />

          <button
            type="submit"
            disabled={!newTaskTitle.trim()}
            className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
        </form>
      </div>

      {/* View Content: Kanban Board or List */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-5">
        {taskViewMode === 'board' ? (
          /* 3-Column Kanban Board with corrected priority/status logic */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full min-h-[450px]">
            {(['todo', 'in_progress', 'done'] as const).map((colStatus) => {
              const colTasks = tasks.filter((t) => {
                const isDone = !!t.task?.completed;
                if (colStatus === 'done') return isDone;
                const isHighPriority = t.task?.priority === 'high' || t.task?.priority === 'urgent';
                if (colStatus === 'in_progress') return !isDone && isHighPriority;
                return !isDone && !isHighPriority;
              });

              const colTitle =
                colStatus === 'todo'
                  ? 'To Do'
                  : colStatus === 'in_progress'
                  ? 'Priority / In Progress'
                  : 'Completed';

              return (
                <div
                  key={colStatus}
                  className="rounded-xl bg-slate-50/70 dark:bg-[#0f0f13] border border-slate-200/80 dark:border-white/[0.06] p-3 flex flex-col min-h-[350px]"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60 dark:border-white/[0.05]">
                    <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      {colTitle}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-white/[0.06] text-slate-500 dark:text-zinc-400">
                      {colTasks.length}
                    </span>
                  </div>

                  <div className="space-y-2 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
                    {colTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => onSelectItem(task.id)}
                        className="p-2.5 rounded-lg bg-white dark:bg-[#141418] border border-slate-200/90 dark:border-white/[0.07] hover:border-blue-400 dark:hover:border-white/[0.16] shadow-2xs space-y-1.5 transition-all cursor-pointer group"
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={!!task.task?.completed}
                            onChange={() => onToggleTask(task)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5 rounded text-blue-600 focus:ring-0 cursor-pointer"
                          />
                          <span
                            className={`text-xs flex-1 leading-snug truncate ${
                              task.task?.completed
                                ? 'line-through text-slate-400 dark:text-zinc-500'
                                : 'text-slate-800 dark:text-zinc-200 font-medium'
                            }`}
                          >
                            {task.title}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500 pt-1 border-t border-slate-100 dark:border-white/[0.03]">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[9px] uppercase font-mono font-semibold px-1 py-0.2 rounded ${
                                task.task?.priority === 'urgent'
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                                  : task.task?.priority === 'high'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                                  : task.task?.priority === 'medium'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-zinc-400'
                              }`}
                            >
                              {task.task?.priority || 'medium'}
                            </span>
                            {task.task?.dueDate && (
                              <span className="flex items-center gap-0.5 text-slate-500 dark:text-zinc-400">
                                <Calendar className="w-2.5 h-2.5" />
                                {task.task.dueDate}
                              </span>
                            )}
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveItem(task.id, task.title);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-500 transition-opacity cursor-pointer"
                            title="Remove from capsule"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {colTasks.length === 0 && (
                      <div className="py-8 text-center text-[11px] text-slate-400 dark:text-zinc-600 border border-dashed border-slate-200 dark:border-white/[0.06] rounded-lg">
                        No tasks
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List / Table View */
          <div className="border border-slate-200 dark:border-white/[0.07] rounded-xl overflow-hidden bg-white dark:bg-[#141418]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#101014] text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-white/[0.07] font-medium text-[11px]">
                <tr>
                  <th className="py-2 px-3 w-8"></th>
                  <th className="py-2 px-3">Title</th>
                  <th className="py-2 px-3 w-24">Priority</th>
                  <th className="py-2 px-3 w-32">Due Date</th>
                  <th className="py-2 px-3 w-16 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    onClick={() => onSelectItem(task.id)}
                    className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={!!task.task?.completed}
                        onChange={() => onToggleTask(task)}
                        className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-medium ${
                          task.task?.completed
                            ? 'line-through text-slate-400 dark:text-zinc-500'
                            : 'text-slate-800 dark:text-zinc-200'
                        }`}
                      >
                        {task.title}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[9px] uppercase font-mono font-semibold px-1.5 py-0.2 rounded ${
                          task.task?.priority === 'urgent'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                            : task.task?.priority === 'high'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-zinc-400'
                        }`}
                      >
                        {task.task?.priority || 'medium'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-zinc-400">
                      {task.task?.dueDate || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveItem(task.id, task.title);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity p-1 cursor-pointer"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 dark:text-zinc-600">
                      No tasks in this capsule yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
