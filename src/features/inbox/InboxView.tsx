import React, { useState, useMemo } from 'react';
import { Sparkles, PenTool } from 'lucide-react';
import { UniversalCapture } from '../../components/capture/UniversalCapture';
import { ItemList } from '../../components/items/ItemList';
import { LandingHeroAiChat } from '../../components/chat/LandingHeroAiChat';
import {
  InboxDropdownFilter,
  InboxCategoryFilter,
} from '../../components/inbox/InboxDropdownFilter';
import { Item, CreateItemInput } from '../../types/item';

interface InboxViewProps {
  items: Item[];
  onCapture: (input: CreateItemInput) => Promise<any>;
  onSelect: (item: Item) => void;
  onToggleTask: (itemId: string, completed: boolean) => void;
  onToggleFavorite: (itemId: string) => void;
  onTrash: (itemId: string) => void;
  onOpenSettings?: () => void;
  onArtifactCreated?: (msg: string) => void;
}

export const InboxView: React.FC<InboxViewProps> = ({
  items,
  onCapture,
  onSelect,
  onToggleTask,
  onToggleFavorite,
  onTrash,
  onOpenSettings,
  onArtifactCreated,
}) => {
  const [heroMode, setHeroMode] = useState<'ai' | 'capture'>('ai');
  const [categoryFilter, setCategoryFilter] = useState<InboxCategoryFilter>('all');

  // Filter items based on selected category dropdown
  const filteredItems = useMemo(() => {
    if (categoryFilter === 'all') return items;
    if (categoryFilter === 'tasks') return items.filter((i) => i.type === 'task');
    if (categoryFilter === 'notes') return items.filter((i) => i.type === 'note');
    if (categoryFilter === 'files') {
      return items.filter(
        (i) => i.type === 'file' || i.type === 'image' || i.type === 'audio'
      );
    }
    if (categoryFilter === 'links') return items.filter((i) => i.type === 'link');
    if (categoryFilter === 'uncategorized') {
      return items.filter((i) => i.type === 'text');
    }
    return items;
  }, [items, categoryFilter]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-12 min-w-0">
      {/* Hero Switcher Dock */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setHeroMode('ai')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                heroMode === 'ai'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Assistant</span>
            </button>
            <button
              onClick={() => setHeroMode('capture')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                heroMode === 'capture'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Quick Capture</span>
            </button>
          </div>

          <span className="text-[11px] font-mono text-slate-400">
            Landing Workstation
          </span>
        </div>

        {/* Hero Card Content */}
        {heroMode === 'ai' ? (
          <LandingHeroAiChat
            onArtifactCreated={onArtifactCreated}
            onOpenSettings={onOpenSettings}
          />
        ) : (
          <UniversalCapture onCapture={onCapture} />
        )}
      </div>

      {/* Inbox Feed & Triage Stream */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          {/* Triage Dropdown Filter */}
          <InboxDropdownFilter
            currentFilter={categoryFilter}
            onSelectFilter={setCategoryFilter}
            items={items}
          />

          <div className="text-xs text-slate-400">
            Showing <span className="font-semibold text-slate-600 dark:text-slate-300">{filteredItems.length}</span> of {items.length} {items.length === 1 ? 'item' : 'items'}
          </div>
        </div>

        <ItemList
          items={filteredItems}
          onSelect={onSelect}
          onToggleTask={onToggleTask}
          onToggleFavorite={onToggleFavorite}
          onTrash={onTrash}
          groupByDate={true}
          emptyMessage={
            categoryFilter === 'all'
              ? 'Your inbox is empty'
              : `No items found in "${categoryFilter}"`
          }
        />
      </div>
    </div>
  );
};
