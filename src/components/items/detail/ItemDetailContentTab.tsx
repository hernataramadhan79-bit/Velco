import React from 'react';
import { ListTodo } from 'lucide-react';
import { Item } from '../../../types/item';
import { MarkdownViewer } from '../../common/MarkdownViewer';

interface ItemDetailContentTabProps {
  item: Item;
  hasFiles: boolean;
  isEditing: boolean;
  content: string;
  displayedNotes: string;
  aiEnabled: boolean;
  isAiLoading: boolean;
  onContentChange: (val: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onStartEdit: () => void;
  onExtractTasks: () => void;
}

export const ItemDetailContentTab: React.FC<ItemDetailContentTabProps> = ({
  item,
  hasFiles,
  isEditing,
  content,
  displayedNotes,
  aiEnabled,
  isAiLoading,
  onContentChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onExtractTasks,
}) => {
  return (
    <div className="space-y-4">
      {isEditing ? (
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          rows={7}
          className="w-full p-3 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-300 dark:border-white/[0.08] text-sm text-slate-900 dark:text-zinc-100 font-sans leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder={
            hasFiles
              ? 'Add custom notes, context, or description for this file...'
              : 'Markdown notes or description...'
          }
          autoFocus
        />
      ) : displayedNotes ? (
        <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-[#101014]/60 border border-slate-200/80 dark:border-white/[0.06] min-h-[70px] text-sm text-slate-800 dark:text-zinc-200 leading-relaxed">
          <MarkdownViewer content={displayedNotes} />
        </div>
      ) : (
        <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-white/[0.08] text-center bg-slate-50/30 dark:bg-white/[0.02]">
          <p className="text-xs text-slate-400 dark:text-zinc-500 mb-2">
            No additional notes or description yet.
          </p>
          <button
            type="button"
            onClick={onStartEdit}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            Add Notes
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
          {displayedNotes ? `${displayedNotes.split(/\s+/).filter(Boolean).length} words` : '0 words'}
        </div>

        {isEditing ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-3 py-1.5 text-xs rounded-lg text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-white/[0.06] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSaveEdit}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-xs cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {aiEnabled && displayedNotes.trim() && item.type !== 'task' && (
              <button
                type="button"
                onClick={onExtractTasks}
                disabled={isAiLoading}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Extract discrete tasks from this note using AI"
              >
                <ListTodo className="w-3.5 h-3.5" />
                <span>Extract Tasks</span>
              </button>
            )}
            {displayedNotes && (
              <button
                type="button"
                onClick={onStartEdit}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/[0.08] transition-colors cursor-pointer"
              >
                Edit Notes
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
