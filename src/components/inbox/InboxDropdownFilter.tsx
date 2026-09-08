import React, { useState, useRef, useEffect } from 'react';
import {
  Filter,
  ChevronDown,
  Check,
  CheckSquare,
  FileText,
  FileIcon,
  Link2,
  Inbox,
  HelpCircle,
} from 'lucide-react';
import { Item, ItemSummary } from '../../types/item';

export type InboxCategoryFilter =
  | 'all'
  | 'tasks'
  | 'notes'
  | 'files'
  | 'links'
  | 'uncategorized';

interface InboxDropdownFilterProps {
  currentFilter: InboxCategoryFilter;
  onSelectFilter: (filter: InboxCategoryFilter) => void;
  items: (Item | ItemSummary)[];
}

export const InboxDropdownFilter: React.FC<InboxDropdownFilterProps> = ({
  currentFilter,
  onSelectFilter,
  items,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Compute category counts
  const counts = React.useMemo(() => {
    let tasks = 0;
    let notes = 0;
    let files = 0;
    let links = 0;
    let uncategorized = 0;

    items.forEach((item) => {
      if (item.type === 'task') tasks++;
      else if (item.type === 'note') notes++;
      else if (item.type === 'file' || item.type === 'image' || item.type === 'audio') files++;
      else if (item.type === 'link') links++;
      else if (item.type === 'text') uncategorized++;
    });

    return {
      all: items.length,
      tasks,
      notes,
      files,
      links,
      uncategorized,
    };
  }, [items]);

  const filterOptions: {
    id: InboxCategoryFilter;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count: number;
  }[] = [
    { id: 'all', label: 'All Items', icon: Inbox, count: counts.all },
    { id: 'tasks', label: 'Tasks Only', icon: CheckSquare, count: counts.tasks },
    { id: 'notes', label: 'Notes Only', icon: FileText, count: counts.notes },
    { id: 'files', label: 'Files & Media', icon: FileIcon, count: counts.files },
    { id: 'links', label: 'Links & Bookmarks', icon: Link2, count: counts.links },
    { id: 'uncategorized', label: 'Uncategorized', icon: HelpCircle, count: counts.uncategorized },
  ];

  const activeOption = filterOptions.find((opt) => opt.id === currentFilter) || filterOptions[0];
  const ActiveIcon = activeOption.icon;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.08] text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] shadow-2xs transition-all cursor-pointer"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5">
          <ActiveIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>{activeOption.label}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-white/[0.08]">
            {activeOption.count}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-500' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-56 rounded-lg bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.08] shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-slate-100 dark:border-white/[0.06] flex items-center gap-1.5">
            <Filter className="w-3 h-3" />
            <span>Inbox Categories</span>
          </div>

          <div className="py-1">
            {filterOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = opt.id === currentFilter;

              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    onSelectFilter(opt.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className={`w-3.5 h-3.5 ${
                        isSelected
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-400 dark:text-zinc-500'
                      }`}
                    />
                    <span>{opt.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-white/[0.08]">
                      {opt.count}
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
