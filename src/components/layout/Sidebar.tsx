import React from 'react';
import {
  Inbox,
  CheckSquare,
  FileText,
  FileIcon,
  Link2,
  Archive,
  Trash2,
  Settings,
  Search,
  PanelLeftClose,
} from 'lucide-react';
import { NavigationView } from '../../stores/itemStore';
import { Tag } from '../../types/item';

interface SidebarProps {
  currentView: NavigationView;
  onSelectView: (view: NavigationView) => void;
  itemCounts: {
    inbox: number;
    tasks: number;
    notes: number;
    files: number;
    links: number;
    archive: number;
    trash: number;
  };
  tags: Tag[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  onOpenSearch: () => void;
  onToggleSidebar?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  itemCounts,
  tags,
  selectedTagId,
  onSelectTag,
  onOpenSearch,
  onToggleSidebar,
}) => {
  const navItems: { id: NavigationView; label: string; icon: any; count?: number }[] = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, count: itemCounts.inbox },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, count: itemCounts.tasks },
    { id: 'notes', label: 'Notes', icon: FileText, count: itemCounts.notes },
    { id: 'files', label: 'Files', icon: FileIcon, count: itemCounts.files },
    { id: 'links', label: 'Links', icon: Link2, count: itemCounts.links },
    { id: 'archive', label: 'Archive', icon: Archive, count: itemCounts.archive },
    { id: 'trash', label: 'Trash', icon: Trash2, count: itemCounts.trash },
  ];

  return (
    <aside className="w-64 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0 h-full select-none">
      {/* Brand Header */}
      <div>
        <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-xs flex items-center justify-center">
              <svg className="w-8 h-8" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="512" height="512" rx="100" fill="#2563eb"/>
                <path d="M120 180 L220 180 L235 240 L277 240 L292 180 L392 180 L360 360 L152 360 Z" fill="#ffffff" opacity="0.95"/>
                <rect x="180" y="140" width="152" height="40" rx="8" fill="#93c5fd"/>
                <circle cx="256" cy="300" r="16" fill="#2563eb"/>
              </svg>
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm tracking-tight leading-none">
                Velco
              </div>
              <div className="text-[11px] text-slate-400 font-medium leading-tight mt-0.5">
                Context Workstation
              </div>
            </div>
          </div>

          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Hide sidebar (Ctrl+B)"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Search Shortcut Button */}
        <div className="p-3">
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5" />
              <span>Search items...</span>
            </span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 font-mono">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Navigation items */}
        <nav className="px-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTag(null);
                  onSelectView(item.id);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive
                        ? 'bg-blue-200/60 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200'
                        : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Tags Section */}
        {tags.length > 0 && (
          <div className="mt-6 px-3">
            <div className="flex items-center justify-between px-1 mb-1.5 text-[11px] font-bold text-slate-400 tracking-wider uppercase">
              <span>Tags</span>
              <button
                onClick={() => {
                  onSelectTag(null);
                  onSelectView('tags');
                }}
                className="hover:text-blue-600 dark:hover:text-blue-400"
                title="Manage tags"
              >
                View all
              </button>
            </div>
            <div className="space-y-0.5 max-h-40 overflow-y-auto">
              {tags.slice(0, 8).map((tag) => {
                const isSelected = selectedTagId === tag.id;
                return (
                  <button
                    key={tag.id}
                    onClick={() => {
                      onSelectView('tags');
                      onSelectTag(isSelected ? null : tag.id);
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="truncate">{tag.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Footer Section */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
        <button
          onClick={() => {
            onSelectTag(null);
            onSelectView('settings');
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            currentView === 'settings'
              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <Settings className="w-4 h-4 text-slate-400" />
          <span>Settings & Backup</span>
        </button>
      </div>
    </aside>
  );
};
