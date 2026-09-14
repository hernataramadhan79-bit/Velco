import React from 'react';
import { Plus } from 'lucide-react';
import { ChatSessionSummary } from '../../types/chat';
import { SessionHistoryPopover } from './SessionHistoryPopover';

interface PlaygroundHeaderProps {
  onNewChat: () => void;
  isGenerating: boolean;
  hasMessages: boolean;
  sessions: ChatSessionSummary[];
  activeSessionId: string | null;
  onSwitchSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onDeleteSession: (id: string) => void;
}

export const PlaygroundHeader: React.FC<PlaygroundHeaderProps> = ({
  onNewChat,
  isGenerating,
  hasMessages,
  sessions,
  activeSessionId,
  onSwitchSession,
  onRenameSession,
  onDeleteSession,
}) => {
  return (
    <div className="h-10 px-4 sm:px-6 bg-white/60 dark:bg-[#09090b]/60 backdrop-blur-md border-b border-slate-200/60 dark:border-white/[0.05] flex items-center justify-between gap-3 shrink-0 z-20 select-none">
      {/* Left: Session history popover trigger */}
      <div className="flex items-center gap-2 min-w-0">
        <SessionHistoryPopover
          sessions={sessions}
          activeSessionId={activeSessionId}
          isGenerating={isGenerating}
          onNewSession={onNewChat}
          onSwitchSession={onSwitchSession}
          onRenameSession={onRenameSession}
          onDeleteSession={onDeleteSession}
        />
      </div>

      {/* Right: New Chat button (shortcut, selain dari popover) */}
      <div className="flex items-center gap-1 shrink-0">
        {hasMessages && (
          <button
            onClick={onNewChat}
            disabled={isGenerating}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/[0.05] text-xs font-medium transition-colors cursor-pointer disabled:opacity-40"
            title="Start new conversation (keeps previous in history)"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2]" />
            <span>New Chat</span>
          </button>
        )}
      </div>
    </div>
  );
};
