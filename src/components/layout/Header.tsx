import React from 'react';
import { AIPrivacyBadge } from './AIPrivacyBadge';
import { useSettings } from '../../stores/settingsStore';
import { useContextStore } from '../../stores/contextStore';
import { Sun, Moon, Laptop, Plus, Zap } from 'lucide-react';
import { NavigationView } from '../../stores/itemStore';

interface HeaderProps {
  currentView: NavigationView;
  onNewCaptureClick?: () => void;
  isFoundryOpen?: boolean;
  onToggleFoundry?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNewCaptureClick,
  isFoundryOpen = false,
  onToggleFoundry,
}) => {
  const { settings, updateSettings } = useSettings();
  const stagedCount = useContextStore((state) => state.stagedItems.length);

  const viewTitles: Record<NavigationView, string> = {
    inbox: 'Inbox',
    tasks: 'Tasks',
    notes: 'Notes',
    files: 'Files & Attachments',
    links: 'Bookmarks & Links',
    tags: 'Tags & Taxonomy',
    archive: 'Archive',
    trash: 'Trash',
    settings: 'Settings & Storage',
  };

  const cycleTheme = () => {
    const themes: ('system' | 'light' | 'dark')[] = ['system', 'light', 'dark'];
    const nextIdx = (themes.indexOf(settings.theme) + 1) % themes.length;
    updateSettings({ theme: themes[nextIdx] });
  };

  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-6 flex items-center justify-between shrink-0 select-none">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          {viewTitles[currentView]}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <AIPrivacyBadge />

        {/* Theme switcher */}
        <button
          onClick={cycleTheme}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-900 transition-colors cursor-pointer"
          title={`Theme: ${settings.theme} (click to toggle)`}
        >
          {settings.theme === 'light' ? (
            <Sun className="w-4 h-4 text-amber-500" />
          ) : settings.theme === 'dark' ? (
            <Moon className="w-4 h-4 text-blue-400" />
          ) : (
            <Laptop className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {/* The Foundry / Context Cart Workstation Toggle Button */}
        {onToggleFoundry && (
          <button
            onClick={onToggleFoundry}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              isFoundryOpen
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 hover:text-slate-800 dark:hover:text-slate-200 shadow-2xs'
            }`}
            title="Toggle The Foundry (Ctrl+J)"
          >
            <Zap className={`w-3.5 h-3.5 ${isFoundryOpen ? 'fill-indigo-600 dark:fill-indigo-400' : ''}`} />
            <span>The Foundry</span>
            {stagedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                {stagedCount}
              </span>
            )}
          </button>
        )}

        {onNewCaptureClick && currentView !== 'inbox' && (
          <button
            onClick={onNewCaptureClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Capture</span>
          </button>
        )}
      </div>
    </header>
  );
};

