import React from 'react';
import { AIPrivacyBadge } from './AIPrivacyBadge';
import { useSettings } from '../../stores/settingsStore';
import { Sun, Moon, Laptop, Plus } from 'lucide-react';
import { NavigationView } from '../../stores/itemStore';

interface HeaderProps {
  currentView: NavigationView;
  onNewCaptureClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNewCaptureClick }) => {
  const { settings, updateSettings } = useSettings();

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
