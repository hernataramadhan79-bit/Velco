import React, { useState, useMemo } from 'react';
import { Bot, PenTool } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'capture' | 'chat'>('capture');
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
      {/* Switcher Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="inline-flex p-0.5 rounded-md bg-[#141418] border border-white/[0.07] text-xs font-mono">
            <button
              onClick={() => setActiveTab('capture')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-all cursor-pointer ${
                activeTab === 'capture'
                  ? 'bg-white/[0.08] text-zinc-100 font-medium border border-white/[0.08] shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <PenTool className="w-3.5 h-3.5 stroke-[1.5]" />
              <span>Quick Capture</span>
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-white/[0.08] text-zinc-100 font-medium border border-white/[0.08] shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Bot className="w-3.5 h-3.5 stroke-[1.5]" />
              <span>Chat Canvas</span>
            </button>
          </div>

          <span className="text-[11px] font-mono text-zinc-500">
            Workstation Stream
          </span>
        </div>

        {/* Selected Mode Component */}
        {activeTab === 'chat' ? (
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
          <InboxDropdownFilter
            currentFilter={categoryFilter}
            onSelectFilter={setCategoryFilter}
            items={items}
          />

          <div className="text-[11px] font-mono text-zinc-500">
            Showing <span className="text-zinc-300 font-semibold">{filteredItems.length}</span> of {items.length} items
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
