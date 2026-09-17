import React from 'react';
import { AIPrivacyBadge } from './AIPrivacyBadge';
import { useSettings } from '../../stores/settingsStore';
import { useContextStore } from '../../stores/contextStore';
import { PanelLeft, Search, Zap, HelpCircle, Plus } from 'lucide-react';
import { useItemStore, NavigationView } from '../../stores/itemStore';
import { modKey, formatShortcut } from '../../utils/platformUtils';
import { usePlaygroundChatStore } from '../../stores/playgroundChatStore';
import { SessionHistoryPopover } from '../../features/playground/SessionHistoryPopover';

interface HeaderProps {
  currentView: NavigationView;
  onNewCaptureClick?: () => void;
  isFoundryOpen?: boolean;
  onToggleFoundry?: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onOpenSearch?: () => void;
  onOpenCheatSheet?: () => void;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  currentView,
  onNewCaptureClick,
  isFoundryOpen = false,
  onToggleFoundry,
  isSidebarOpen = true,
  onToggleSidebar,
  onOpenSearch,
  onOpenCheatSheet,
}) => {
  const { settings, updateSettings } = useSettings();
  const stagedCount = useContextStore((state) => state.stagedItems.length);
  const appMode = useItemStore((s) => s.appMode);
  const setAppMode = useItemStore((s) => s.setAppMode);

  const PAGE_TITLES: Record<NavigationView, string> = {
    inbox: 'Inbox',
    playground: 'Playground',
    workbench: 'Workbench',
    bridge: 'Context Hub',
    tasks: 'Tasks',
    notes: 'Notes',
    files: 'Files',
    links: 'Links',
    tags: 'Tags',
    archive: 'Archive',
    trash: 'Trash',
    settings: 'Settings',
  };



const PlaygroundHeaderControls: React.FC = React.memo(() => {
  const {
    sessions,
    activeSessionId,
    isGenerating,
    newSession,
    switchSession,
    renameSession,
    deleteSession,
    messages,
  } = usePlaygroundChatStore();

  return (
    <div className="flex items-center gap-1 ml-0.5 not-italic font-sans">
      <SessionHistoryPopover
        sessions={sessions}
        activeSessionId={activeSessionId}
        isGenerating={isGenerating}
        onNewSession={newSession}
        onSwitchSession={switchSession}
        onRenameSession={renameSession}
        onDeleteSession={deleteSession}
      />
      <button
        type="button"
        onClick={newSession}
        disabled={isGenerating || (!activeSessionId && messages.length === 0)}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
        title="New Chat Session"
      >
        <Plus className="w-3.5 h-3.5 stroke-[2]" />
        <span className="hidden sm:inline text-[11px]">New Chat</span>
      </button>
    </div>
  );
});
PlaygroundHeaderControls.displayName = 'PlaygroundHeaderControls';

  return (
    <header
      data-tauri-drag-region
      className="h-11 border-b border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#09090b] px-4 flex items-center justify-between shrink-0 select-none z-10 text-slate-800 dark:text-zinc-100"
    >
      {/* Left: Sidebar Toggle + Uppercase Mono Breadcrumb + Playground Controls */}
      <div className="flex items-center gap-2 min-w-0" data-tauri-drag-region>
        {!isSidebarOpen && onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer shrink-0"
            title={`Open sidebar (${modKey}+B)`}
          >
            <PanelLeft className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>
        )}

        <div className="flex items-center gap-2 shrink-0" data-tauri-drag-region>
          <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
            {appMode === 'context-hub' ? 'Context Hub' : (PAGE_TITLES[currentView] || 'Velco')}
          </span>
        </div>

        {currentView === 'playground' && appMode !== 'context-hub' && (
          <PlaygroundHeaderControls />
        )}
      </div>

      {/* Center: Command Palette Trigger Pill */}
      {onOpenSearch && (
        <div className="hidden md:flex items-center justify-center flex-1 px-4 max-w-sm">
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#141418] border border-slate-200 dark:border-white/[0.07] hover:border-slate-300 dark:hover:border-white/[0.14] text-slate-500 dark:text-zinc-500 hover:text-slate-800 dark:hover:text-zinc-300 text-xs transition-all cursor-pointer shadow-2xs"
          >
            <span className="flex items-center gap-2">
              <Search className="w-3 h-3 stroke-[1.5]" />
              <span className="text-[11px] text-slate-600 dark:text-zinc-400">Search workstation...</span>
            </span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-white/[0.04] border border-slate-300/80 dark:border-white/[0.07] text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
              {formatShortcut('K')}
            </kbd>
          </button>
        </div>
      )}

      {/* Right: Engine Telemetry & Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <AIPrivacyBadge />

        {/* App Mode Toggle (Personal vs Context Hub) */}
        <div className="flex items-center bg-slate-100 dark:bg-[#141418] p-0.5 rounded-md border border-slate-200 dark:border-white/[0.07]">
          <button
            onClick={() => setAppMode('personal')}
            className={`px-2.5 py-1 rounded-[4px] text-[11px] font-mono transition-all cursor-pointer ${
              appMode === 'personal'
                ? 'bg-white dark:bg-white/[0.1] text-slate-900 dark:text-zinc-100 shadow-xs font-semibold'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            Personal
          </button>
          <button
            onClick={() => setAppMode('context-hub')}
            className={`px-2.5 py-1 rounded-[4px] text-[11px] font-mono transition-all cursor-pointer ${
              appMode === 'context-hub'
                ? 'bg-blue-500 text-white shadow-xs font-semibold'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            Context Hub
          </button>
        </div>

        {/* Studio / Workbench Toggle (Replaced theme toggle, same size & shape) */}
        {onToggleFoundry && (
          <button
            onClick={onToggleFoundry}
            className={`relative p-1 rounded-md border border-slate-200 dark:border-white/[0.07] transition-colors cursor-pointer ${
              isFoundryOpen
                ? 'bg-slate-200 dark:bg-white/[0.12] text-blue-500 border-blue-500/40 shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 bg-slate-100 dark:bg-[#141418] hover:bg-slate-200/80 dark:hover:bg-[#1a1a20]'
            }`}
            title={`Toggle Studio Workbench (${modKey}+J)`}
          >
            <Zap className={`w-3.5 h-3.5 stroke-[1.5] ${isFoundryOpen ? 'fill-blue-500 text-blue-500' : ''}`} />
            {stagedCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
            )}
          </button>
        )}

        {/* Shortcuts Cheat Sheet Button */}
        {onOpenCheatSheet && (
          <button
            onClick={onOpenCheatSheet}
            className="p-1 rounded-md border border-slate-200 dark:border-white/[0.07] bg-slate-100 dark:bg-[#141418] hover:bg-slate-200 dark:hover:bg-[#1a1a20] text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            title="Keyboard Shortcuts (?)"
          >
            <HelpCircle className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>
        )}
      </div>
    </header>
  );
});

Header.displayName = 'Header';
