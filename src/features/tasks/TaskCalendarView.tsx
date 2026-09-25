import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Circle, CheckCircle2 } from 'lucide-react';
import { ItemSummary } from '../../types/item';

interface TaskCalendarViewProps {
  tasks: ItemSummary[];
  onSelect: (item: ItemSummary) => void;
  onToggleTask: (itemId: string, completed: boolean) => void;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-rose-500',
  high: 'bg-amber-500',
  medium: 'bg-blue-500',
  low: 'bg-slate-400',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const TaskCalendarView: React.FC<TaskCalendarViewProps> = ({
  tasks,
  onSelect,
  onToggleTask,
}) => {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  // Build map: "YYYY-MM-DD" → tasks[]
  const tasksByDate = useMemo(() => {
    const map = new Map<string, ItemSummary[]>();
    for (const task of tasks) {
      if (!task.task?.dueDate) continue;
      const dateKey = task.task.dueDate.slice(0, 10); // "YYYY-MM-DD"
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(task);
    }
    return map;
  }, [tasks]);

  const selectedDateKey = selectedDay !== null
    ? `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : null;

  const selectedTasks = selectedDateKey ? (tasksByDate.get(selectedDateKey) ?? []) : [];

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(v => v - 1); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(v => v + 1); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  };

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Build calendar grid cells
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Calendar Grid */}
      <div className="flex-1 min-w-0 bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] overflow-hidden shadow-2xs">
        {/* Month Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/[0.06]">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 dark:text-zinc-400 transition-colors cursor-pointer"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h3>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 dark:text-zinc-400 transition-colors cursor-pointer"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-slate-100 dark:border-white/[0.06]">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              {d}
            </div>
          ))}
        </div>

        {/* Grid Cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="aspect-square border-b border-r border-slate-100 dark:border-white/[0.04] last:border-r-0" />;
            }

            const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayTasks = tasksByDate.get(dateKey) ?? [];
            const isToday = dateKey === todayKey;
            const isSelected = day === selectedDay;
            const hasOverdue = dayTasks.some(t => !t.task?.completed && dateKey < todayKey);
            const pendingCount = dayTasks.filter(t => !t.task?.completed).length;
            const completedCount = dayTasks.filter(t => t.task?.completed).length;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                className={`aspect-square min-h-[52px] p-1.5 border-b border-r border-slate-100 dark:border-white/[0.04] last:border-r-0 flex flex-col items-start text-left transition-colors cursor-pointer relative
                  ${isSelected ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'}
                  ${(idx + 1) % 7 === 0 ? 'border-r-0' : ''}
                `}
                aria-label={`${day} ${MONTH_NAMES[viewMonth]}`}
              >
                {/* Day number */}
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mb-1
                  ${isToday ? 'bg-blue-600 text-white font-bold' : isSelected ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-zinc-300'}
                `}>
                  {day}
                </span>

                {/* Priority dots for tasks */}
                {dayTasks.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-auto">
                    {dayTasks.slice(0, 4).map((t, ti) => (
                      <span
                        key={ti}
                        className={`w-1.5 h-1.5 rounded-full ${t.task?.completed ? 'bg-slate-300 dark:bg-slate-600' : PRIORITY_DOT[t.task?.priority ?? 'medium']}`}
                      />
                    ))}
                    {dayTasks.length > 4 && (
                      <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-medium">+{dayTasks.length - 4}</span>
                    )}
                  </div>
                )}

                {/* Overdue indicator */}
                {hasOverdue && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day Detail Panel */}
      <div className="lg:w-72 xl:w-80 bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] overflow-hidden shadow-2xs flex flex-col">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06]">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            {selectedDay !== null
              ? `${MONTH_NAMES[viewMonth]} ${selectedDay}, ${viewYear}`
              : 'Select a day'}
          </h3>
          {selectedDay !== null && (
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
              {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} due
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {selectedDay === null ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-500">Click a day to see tasks</p>
            </div>
          ) : selectedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">No tasks due</p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Free day!</p>
            </div>
          ) : (
            selectedTasks.map((task) => (
              <div
                key={task.id}
                className="group flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-100 dark:border-white/[0.06] hover:border-slate-200 dark:hover:border-white/[0.1] transition-colors bg-slate-50/50 dark:bg-[#0e131f]/50"
              >
                {/* Checkbox */}
                <button
                  onClick={() => onToggleTask(task.id, !task.task?.completed)}
                  className="mt-0.5 shrink-0 transition-colors cursor-pointer"
                  aria-label={task.task?.completed ? 'Mark incomplete' : 'Mark complete'}
                >
                  {task.task?.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400" />
                  )}
                </button>

                {/* Task info */}
                <div className="flex-1 min-w-0" onClick={() => onSelect(task)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onSelect(task)}>
                  <p className={`text-xs font-medium leading-relaxed ${task.task?.completed ? 'line-through text-slate-400 dark:text-zinc-500' : 'text-slate-800 dark:text-zinc-200'}`}>
                    {task.title}
                  </p>
                  {task.task?.priority && (
                    <span className={`inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded capitalize
                      ${task.task.priority === 'urgent' ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                        : task.task.priority === 'high' ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                        : task.task.priority === 'medium' ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {task.task.priority}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
