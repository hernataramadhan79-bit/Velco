import React, { useState } from 'react';
import { Item, TaskBatchSource } from '../../types/item';
import { ItemCard } from '../items/ItemCard';
import {
  Sparkles,
  Bot,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  FileText,
  Check,
} from 'lucide-react';
import { useItemStore } from '../../stores/itemStore';

interface TaskBatchSectionProps {
  meta: TaskBatchSource;
  tasks: Item[];
  onSelect: (item: Item) => void;
  onToggleTask: (itemId: string, completed: boolean) => void;
  onToggleFavorite: (itemId: string) => void;
  onTrash: (itemId: string) => void;
}

export const TaskBatchSection: React.FC<TaskBatchSectionProps> = ({
  meta,
  tasks,
  onSelect,
  onToggleTask,
  onToggleFavorite,
  onTrash,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const items = useItemStore((state) => state.items);

  const completedCount = tasks.filter((t) => !!t.task?.completed).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isAllCompleted = totalCount > 0 && completedCount === totalCount;

  // Locate source note if available
  const sourceItem = meta.sourceItemId
    ? items.find((i) => i.id === meta.sourceItemId)
    : null;

  const handleCompleteAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shouldComplete = !isAllCompleted;
    tasks.forEach((t) => {
      if (!!t.task?.completed !== shouldComplete) {
        onToggleTask(t.id, shouldComplete);
      }
    });
  };

  const handleOpenSource = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sourceItem) {
      onSelect(sourceItem);
    }
  };

  const isChatOrigin = meta.origin === 'ai_chat';

  return (
    <div className="bg-slate-50/70 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden transition-all shadow-xs">
      {/* Batch Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-3 bg-white/70 dark:bg-slate-900/80 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
              isChatOrigin
                ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400'
                : 'bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400'
            }`}
          >
            {isChatOrigin ? (
              <Bot className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
          </div>

          <div className="min-w-0 flex items-center gap-2">
            <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
              {meta.batchTitle || (isChatOrigin ? 'Chat Task Group' : 'Extracted Tasks')}
            </h3>

            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 border ${
                isChatOrigin
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/60'
                  : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200/60 dark:border-purple-800/60'
              }`}
            >
              {isChatOrigin ? 'AI Chat Batch' : 'Extracted from Item'}
            </span>
          </div>
        </div>

        {/* Right side stats & actions */}
        <div className="flex items-center gap-3 shrink-0 text-xs">
          {/* Progress bar pill */}
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden hidden sm:block">
              <div
                className={`h-full transition-all duration-300 ${
                  isAllCompleted ? 'bg-emerald-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {completedCount}/{totalCount}
            </span>
          </div>

          {/* Optional Source Note button */}
          {sourceItem && (
            <button
              type="button"
              onClick={handleOpenSource}
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
              title={`View source: ${sourceItem.title}`}
            >
              <FileText className="w-3 h-3 text-slate-400" />
              <span className="truncate max-w-[100px]">{sourceItem.title}</span>
            </button>
          )}

          {/* Quick Mark Batch Completed */}
          <button
            type="button"
            onClick={handleCompleteAll}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              isAllCompleted
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
            title={isAllCompleted ? 'Mark all pending' : 'Mark all completed'}
          >
            {isAllCompleted ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span>Completed</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3 text-slate-400" />
                <span>Complete All</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grouped Task List */}
      {isExpanded && (
        <div className="p-3 space-y-2 border-t border-slate-200/60 dark:border-slate-800/60">
          {tasks.map((task) => (
            <ItemCard
              key={task.id}
              item={task}
              onSelect={onSelect}
              onToggleTask={onToggleTask}
              onToggleFavorite={onToggleFavorite}
              onTrash={onTrash}
            />
          ))}
        </div>
      )}
    </div>
  );
};
