import React from 'react';
import { Plus, Trash2, Layers } from 'lucide-react';

interface PlaygroundHeaderProps {
  onNewChat: () => void;
  onClearChat: () => void;
  isGenerating: boolean;
  hasMessages: boolean;
  contextCount: number;
}

export const PlaygroundHeader: React.FC<PlaygroundHeaderProps> = ({
  onNewChat,
  onClearChat,
  isGenerating,
  hasMessages,
  contextCount,
}) => {
  // If there are no messages and no context items attached, the header can remain minimal and unobtrusive
  return (
    <div className="h-10 px-4 sm:px-6 bg-white/60 dark:bg-[#09090b]/60 backdrop-blur-md border-b border-slate-200/60 dark:border-white/[0.05] flex items-center justify-between gap-3 shrink-0 z-20 select-none">
      {/* Left: Optional attached context indicator */}
      <div className="flex items-center gap-2 min-w-0">
        {contextCount > 0 ? (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-zinc-400">
            <Layers className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>{contextCount} context items</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400 dark:text-zinc-600 font-medium">
            Playground
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {hasMessages && (
          <>
            <button
              onClick={onNewChat}
              disabled={isGenerating}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/[0.05] text-xs font-medium transition-colors cursor-pointer disabled:opacity-40"
              title="Start fresh conversation"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2]" />
              <span>New Chat</span>
            </button>

            <button
              onClick={onClearChat}
              disabled={isGenerating}
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-40"
              title="Clear thread"
            >
              <Trash2 className="w-3.5 h-3.5 stroke-[1.5]" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
