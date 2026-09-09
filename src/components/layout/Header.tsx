import React from 'react';
import { AIPrivacyBadge } from './AIPrivacyBadge';
import { useSettings } from '../../stores/settingsStore';
import { useContextStore } from '../../stores/contextStore';
import { Sun, Moon, Laptop, PanelLeft, Search, Zap, Cpu } from 'lucide-react';
import { NavigationView } from '../../stores/itemStore';

interface HeaderProps {
  currentView: NavigationView;
  onNewCaptureClick?: () => void;
  isFoundryOpen?: boolean;
  onToggleFoundry?: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onOpenSearch?: () => void;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  currentView,
  onNewCaptureClick,
  isFoundryOpen = false,
  onToggleFoundry,
  isSidebarOpen = true,
  onToggleSidebar,
  onOpenSearch,
}) => {
  const { settings, updateSettings } = useSettings();
  const stagedCount = useContextStore((state) => state.stagedItems.length);

  const breadcrumbs: Record<NavigationView, string> = {
    inbox: 'VELCO / WORKSTATION / INBOX',
    playground: 'VELCO / PLAYGROUND',
    workbench: 'VELCO / WORKBENCH',
    bridge: 'VELCO / CONTEXT HUB',
    tasks: 'VELCO / WORKSTATION / TASKS',
    notes: 'VELCO / WORKSTATION / NOTES',
    files: 'VELCO / WORKSTATION / FILES',
    links: 'VELCO / WORKSTATION / LINKS',
    tags: 'VELCO / TAXONOMY / TAGS',
    archive: 'VELCO / ARCHIVE',
    trash: 'VELCO / SYSTEM / TRASH',
    settings: 'VELCO / SYSTEM / SETTINGS',
  };

  const cycleTheme = () => {
    const themes: ('system' | 'light' | 'dark')[] = ['system', 'light', 'dark'];
    const nextIdx = (themes.indexOf(settings.theme) + 1) % themes.length;
    updateSettings({ theme: themes[nextIdx] });
  };

  return (
    <header
      data-tauri-drag-region
      className="h-11 border-b border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#09090b] px-4 flex items-center justify-between shrink-0 select-none z-10 text-slate-800 dark:text-zinc-100"
    >
      {/* Left: Sidebar Toggle + Uppercase Mono Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0" data-tauri-drag-region>
        {!isSidebarOpen && onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
            title="Open sidebar (Ctrl+B)"
          >
            <PanelLeft className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>
        )}

        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400 dark:text-zinc-500 tracking-wider truncate" data-tauri-drag-region>
          <span className="text-slate-800 dark:text-zinc-300 font-semibold">{breadcrumbs[currentView] || 'VELCO'}</span>
        </div>
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
            <kbd className="px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-white/[0.04] border border-slate-300/80 dark:border-white/[0.07] text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
              Ctrl+K
            </kbd>
          </button>
        </div>
      )}

      {/* Right: Engine Telemetry & Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <AIPrivacyBadge />

        {/* Studio / Workbench Toggle */}
        {onToggleFoundry && (
          <button
            onClick={onToggleFoundry}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-mono transition-all cursor-pointer ${
              isFoundryOpen
                ? 'bg-slate-200 dark:bg-white/[0.1] border-slate-300 dark:border-white/[0.2] text-slate-900 dark:text-zinc-100 shadow-xs font-semibold'
                : 'bg-slate-100 dark:bg-[#141418] border-slate-200 dark:border-white/[0.07] text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:border-slate-300 dark:hover:border-white/[0.14]'
            }`}
            title="Toggle Studio Workbench (Ctrl+J)"
          >
            <Zap className={`w-3 h-3 ${isFoundryOpen ? 'fill-blue-500 text-blue-500' : ''}`} />
            <span>Workbench</span>
            {stagedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-blue-600 text-white text-[10px] font-bold">
                {stagedCount}
              </span>
            )}
          </button>
        )}

        {/* Theme Switcher */}
        <button
          onClick={cycleTheme}
          className="p-1 rounded-md border border-slate-200 dark:border-white/[0.07] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 bg-slate-100 dark:bg-[#141418] hover:bg-slate-200/80 dark:hover:bg-[#1a1a20] transition-colors cursor-pointer"
          title={`Theme: ${settings.theme} (click to toggle)`}
        >
          {settings.theme === 'light' ? (
            <Sun className="w-3.5 h-3.5 text-amber-500 stroke-[1.5]" />
          ) : settings.theme === 'dark' ? (
            <Moon className="w-3.5 h-3.5 text-blue-400 stroke-[1.5]" />
          ) : (
            <Laptop className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 stroke-[1.5]" />
          )}
        </button>
      </div>
    </header>
  );
});

Header.displayName = 'Header';
