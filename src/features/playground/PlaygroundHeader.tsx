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

      {/* Right slot reserved for future contextual controls */}
      <div className="flex items-center gap-1 shrink-0" />
    </div>
  );
};
