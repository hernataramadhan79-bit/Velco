import React from 'react';
import {
  Inbox,
  CheckSquare,
  FileText,
  Folder,
  Link2,
  Archive,
  Trash2,
  Settings,
  Search,
  PanelLeftClose,
  Tag as TagIcon,
  ChevronRight,
  X,
  Bot,
  Zap,
  GitBranch,
} from 'lucide-react';
import { NavigationView } from '../../stores/itemStore';
import { Tag } from '../../types/item';
import { useSettings } from '../../stores/settingsStore';

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
  overdueCount?: number;
  tags: Tag[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  onOpenSearch: () => void;
  onToggleSidebar?: () => void;
}

interface NavEntry {
  id: NavigationView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = React.memo(({
  currentView,
  onSelectView,
  itemCounts,
  overdueCount = 0,
  tags,
  selectedTagId,
  onSelectTag,
  onOpenSearch,
  onToggleSidebar,
}) => {
  const { settings } = useSettings();

  const knowledgeNav: NavEntry[] = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, count: itemCounts.inbox },
    { id: 'notes', label: 'Notes', icon: FileText, count: itemCounts.notes },
    { id: 'files', label: 'Files', icon: Folder, count: itemCounts.files },
    { id: 'links', label: 'Links', icon: Link2, count: itemCounts.links },
  ];

  const intelligenceNav: NavEntry[] = [
    { id: 'playground', label: 'Playground', icon: Bot },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, count: itemCounts.tasks },
  ];

  const systemNav: NavEntry[] = [
    { id: 'tags', label: 'Tags', icon: TagIcon },
    { id: 'archive', label: 'Archive', icon: Archive, count: itemCounts.archive },
    { id: 'trash', label: 'Trash', icon: Trash2, count: itemCounts.trash },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const selectedTag = tags.find((t) => t.id === selectedTagId);

  const activeProvider = settings.aiProvider === 'none' ? 'None' :
    settings.aiProvider === 'ollama' ? 'Ollama' :
    settings.aiProvider === 'lmstudio' ? 'LM Studio' :
    settings.aiProvider.charAt(0).toUpperCase() + settings.aiProvider.slice(1);

  const isLocalAi = ['ollama', 'lmstudio'].includes(settings.aiProvider);

  const renderNavGroup = (title: string, items: NavEntry[]) => (
    <div className="space-y-1">
      <div className="text-[10px] font-mono tracking-wider text-slate-400 dark:text-zinc-500 uppercase px-3 py-1 font-semibold select-none">
        {title}
      </div>
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectTag(null);
                onSelectView(item.id);
              }}
              className={`w-full group flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 font-medium border border-slate-200 dark:border-white/[0.08] shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-slate-900 dark:text-zinc-100 stroke-[1.8]' : 'text-slate-400 dark:text-zinc-500 group-hover:text-slate-700 dark:group-hover:text-zinc-300 stroke-[1.5]'
                  }`}
                />
                <span className="truncate tracking-tight">{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {item.id === 'tasks' && overdueCount > 0 && (
                  <span
                    className="px-1.5 py-0.2 rounded font-mono bg-rose-500/15 border border-rose-500/30 text-rose-500 dark:text-rose-400 text-[10px] font-bold"
                    title={`${overdueCount} task overdue`}
                  >
                    {overdueCount}
                  </span>
                )}
                {item.badge && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] text-slate-500 dark:text-zinc-400">
                    {item.badge}
                  </span>
                )}
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                      isActive
                        ? 'bg-slate-200/80 dark:bg-white/[0.08] text-slate-800 dark:text-zinc-200 border border-slate-300 dark:border-white/[0.06]'
                        : 'bg-slate-100 dark:bg-white/[0.03] text-slate-500 dark:text-zinc-500 border border-slate-200/60 dark:border-white/[0.03]'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <aside className="w-64 bg-white dark:bg-[#0d0d10] border-r border-slate-200 dark:border-white/[0.07] flex flex-col justify-between shrink-0 h-full select-none text-slate-800 dark:text-zinc-100">
      {/* Brand Header */}
      <div>
        <div className="h-12 px-3.5 border-b border-slate-200 dark:border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.1] flex items-center justify-center shadow-xs">
              <svg className="w-3.5 h-3.5" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="512" height="512" rx="100" fill="#18181b"/>
                <path d="M120 180 L220 180 L235 240 L277 240 L292 180 L392 180 L360 360 L152 360 Z" fill="#ffffff" opacity="0.95"/>
                <circle cx="256" cy="300" r="20" fill="#3b82f6"/>
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 dark:text-zinc-100 text-xs tracking-tight">
                VELCO
              </span>
              <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 bg-slate-100 dark:bg-white/[0.04] px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/[0.05]">
                v0.2.x
              </span>
            </div>
          </div>

          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors cursor-pointer"
              title="Hide sidebar (Ctrl+B)"
            >
              <PanelLeftClose className="w-4 h-4 stroke-[1.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Center Navigation */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2.5 py-3 space-y-4">
        {/* Quick Search Trigger */}
        <div>
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-white/[0.07] text-slate-500 dark:text-zinc-500 hover:text-slate-800 dark:hover:text-zinc-300 hover:border-slate-300 dark:hover:border-white/[0.12] text-xs transition-all cursor-pointer shadow-2xs"
          >
            <span className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 stroke-[1.5]" />
              <span className="text-slate-600 dark:text-zinc-400">Search items...</span>
            </span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-white/[0.05] border border-slate-300/70 dark:border-white/[0.08] text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* 1. KNOWLEDGE */}
        {renderNavGroup('Knowledge', knowledgeNav)}

        {/* 2. INTELLIGENCE */}
        {renderNavGroup('Intelligence', intelligenceNav)}

        {/* 3. SYSTEM */}
        {renderNavGroup('System', systemNav)}

        {/* Tags Quick Filter section if tags exist */}
        {tags.length > 0 && (
          <div className="pt-2 border-t border-slate-200 dark:border-white/[0.06] space-y-1">
            <div className="text-[10px] font-mono tracking-wider text-slate-400 dark:text-zinc-500 uppercase px-3 py-1 font-semibold flex items-center justify-between">
              <span>Tags</span>
              <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-600">{tags.length}</span>
            </div>

            {selectedTag && (
              <div className="mx-1 px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-between text-xs text-blue-700 dark:text-blue-300">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: selectedTag.color }} />
                  <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">#</span>
                  <span className="truncate font-medium text-[11px]">{selectedTag.name}</span>
                </div>
                <button
                  onClick={() => onSelectTag(null)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 p-0.5 cursor-pointer"
                  title="Clear filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <div className="space-y-0.5 max-h-36 overflow-y-auto overflow-x-hidden px-1">
              {tags.slice(0, 8).map((tag) => {
                const isSelected = selectedTagId === tag.id;
                return (
                  <button
                    key={tag.id}
                    onClick={() => {
                      onSelectView('tags');
                      onSelectTag(isSelected ? null : tag.id);
                    }}
                    className={`w-full group flex items-center justify-between px-2 py-1 rounded text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 font-medium'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100/60 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-600">#</span>
                      <span className="truncate text-[11px]">{tag.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Telemetry & Status Chip */}
      <div className="p-2.5 border-t border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#0d0d10]">
        <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-white/[0.06] text-[11px] font-mono">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                settings.aiEnabled
                  ? isLocalAi
                    ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                    : 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]'
                  : 'bg-zinc-400 dark:bg-zinc-600'
              }`}
            />
            <span className="text-slate-600 dark:text-zinc-400 truncate">
              {settings.aiEnabled ? activeProvider : 'AI Disabled'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-zinc-600 uppercase">
            {isLocalAi ? 'Local' : 'Cloud'}
          </span>
        </div>
      </div>
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';
