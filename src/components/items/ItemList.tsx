import React, { useState, useRef } from 'react';
import { Item, ItemSummary } from '../../types/item';
import { ItemCard } from './ItemCard';
import { Inbox, ChevronDown, ChevronRight } from 'lucide-react';
import { useSelectionStore } from '../../stores/selectionStore';
import { useVirtualizer } from '@tanstack/react-virtual';

interface ItemListProps {
  items: (Item | ItemSummary)[];
  onSelect: (item: any) => void;
  onToggleTask?: (itemId: string, completed: boolean) => void;
  onToggleFavorite?: (itemId: string) => void;
  onTrash?: (itemId: string) => void;
  onRestore?: (itemId: string) => void;
  onPermanentDelete?: (itemId: string) => void;
  isTrashView?: boolean;
  emptyMessage?: string;
  groupByDate?: boolean;
}

export const ItemList: React.FC<ItemListProps> = ({
  items,
  onSelect,
  onToggleTask,
  onToggleFavorite,
  onTrash,
  onRestore,
  onPermanentDelete,
  isTrashView = false,
  emptyMessage = 'No items found in this view',
  groupByDate = false,
}) => {
  const selectedIds = useSelectionStore((state) => state.selectedIds);
  const selectAll = useSelectionStore((state) => state.selectAll);
  const clearSelection = useSelectionStore((state) => state.clearSelection);

  const allIdsInList = items.map((i) => i.id);
  const allSelectedInList =
    allIdsInList.length > 0 && allIdsInList.every((id) => selectedIds.has(id));
  const someSelectedInList = allIdsInList.some((id) => selectedIds.has(id));

  const [collapsedGroups, setCollapsedGroups] = useState<{ [key: string]: boolean }>({
    thisWeek: false,
    earlier: true,
  });

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center view-enter select-none">
        <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-slate-500 dark:text-zinc-400 mb-4 shadow-xs">
          <Inbox className="w-5 h-5 stroke-[1.5]" />
        </div>

        <h3 className="text-xs font-semibold text-slate-800 dark:text-zinc-200 mb-1 tracking-tight">
          {emptyMessage}
        </h3>

        <p className="text-xs text-slate-500 dark:text-zinc-500 max-w-xs leading-relaxed font-mono">
          Capture notes, tasks, or drop attachments.
          <br />
          <span className="text-slate-600 dark:text-zinc-400">
            Press <kbd className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] text-[10px] text-slate-700 dark:text-zinc-300">Ctrl+K</kbd> to search.
          </span>
        </p>
      </div>
    );
  }

  const renderSelectionBar = () => {
    if (!someSelectedInList) return null;
    return (
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-slate-800 dark:text-zinc-200 bg-white dark:bg-[#141418] rounded-md border border-slate-200 dark:border-white/[0.08] mb-2 shadow-2xs font-mono">
        <label className="flex items-center gap-2 cursor-pointer select-none font-medium">
          <input
            type="checkbox"
            checked={allSelectedInList}
            onChange={(e) => {
              if (e.target.checked) {
                selectAll(allIdsInList);
              } else {
                clearSelection();
              }
            }}
            className="w-3.5 h-3.5 rounded bg-white dark:bg-zinc-800 border-slate-300 dark:border-white/[0.2] text-blue-600 focus:ring-0 cursor-pointer"
          />
          <span className="text-[11px]">
            {allSelectedInList ? 'All items selected' : `Select all ${items.length} items`}
          </span>
        </label>
        <button
          type="button"
          onClick={clearSelection}
          className="text-[11px] text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
        >
          Deselect
        </button>
      </div>
    );
  };

  // Flat list
  if (!groupByDate) {
    return (
      <FlatVirtualList
        items={items}
        renderSelectionBar={renderSelectionBar}
        onSelect={onSelect}
        onToggleTask={onToggleTask}
        onToggleFavorite={onToggleFavorite}
        onTrash={onTrash}
        onRestore={onRestore}
        onPermanentDelete={onPermanentDelete}
        isTrashView={isTrashView}
      />
    );
  }

  // Date bucket grouping
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfThisWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const grouped: {
    key: string;
    title: string;
    items: (Item | ItemSummary)[];
  }[] = [
    {
      key: 'today',
      title: 'Today',
      items: [],
    },
    {
      key: 'yesterday',
      title: 'Yesterday',
      items: [],
    },
    {
      key: 'thisWeek',
      title: 'This Week',
      items: [],
    },
    {
      key: 'earlier',
      title: 'Earlier',
      items: [],
    },
  ];

  items.forEach((item) => {
    if (!item) return;
    const itemTime = item.createdAt ? new Date(item.createdAt).getTime() : NaN;
    if (isNaN(itemTime)) {
      grouped[3].items.push(item);
    } else if (itemTime >= startOfToday) {
      grouped[0].items.push(item);
    } else if (itemTime >= startOfYesterday) {
      grouped[1].items.push(item);
    } else if (itemTime >= startOfThisWeek) {
      grouped[2].items.push(item);
    } else {
      grouped[3].items.push(item);
    }
  });

  return (
    <div className="space-y-4 w-full min-w-0">
      {renderSelectionBar()}
      {grouped.map((group) => {
        if (group.items.length === 0) return null;
        const isCollapsed = Boolean(collapsedGroups[group.key]);

        return (
          <div key={group.key} className="space-y-1.5">
            {/* Accordion Group Header */}
            <button
              onClick={() => toggleGroup(group.key)}
              className="w-full flex items-center justify-between py-1 px-1 rounded text-left group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-slate-600 dark:text-zinc-500 dark:group-hover:text-zinc-300" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-slate-500 dark:text-zinc-400" />
                )}
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 group-hover:text-slate-800 dark:text-zinc-500 dark:group-hover:text-zinc-300 font-semibold">
                  {group.title}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/[0.04] text-slate-500 dark:text-zinc-500 border border-slate-200/60 dark:border-white/[0.04]">
                  {group.items.length}
                </span>
              </div>
            </button>

            {/* Accordion Content */}
            {!isCollapsed && (
              <div className="space-y-2 w-full min-w-0">
                {group.items.map((item) => {
                  if (!item) return null;
                  return (
                    <ItemCard
                      key={item.id}
                      item={item as Item}
                      onSelect={onSelect as any}
                      onToggleTask={onToggleTask}
                      onToggleFavorite={onToggleFavorite}
                      onTrash={onTrash}
                      onRestore={onRestore}
                      onPermanentDelete={onPermanentDelete}
                      isTrashView={isTrashView}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface FlatVirtualListProps {
  items: (Item | ItemSummary)[];
  renderSelectionBar: () => React.ReactNode;
  onSelect: (item: any) => void;
  onToggleTask?: (itemId: string, completed: boolean) => void;
  onToggleFavorite?: (itemId: string) => void;
  onTrash?: (itemId: string) => void;
  onRestore?: (itemId: string) => void;
  onPermanentDelete?: (itemId: string) => void;
  isTrashView?: boolean;
}

const FlatVirtualList: React.FC<FlatVirtualListProps> = ({
  items,
  renderSelectionBar,
  onSelect,
  onToggleTask,
  onToggleFavorite,
  onTrash,
  onRestore,
  onPermanentDelete,
  isTrashView,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="w-full min-w-0" style={{ height: '100%', overflow: 'auto' }}>
      {renderSelectionBar()}
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          if (!item) return null;
          return (
            <div
              key={item.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="pb-2">
                <ItemCard
                  item={item as Item}
                  onSelect={onSelect as any}
                  onToggleTask={onToggleTask}
                  onToggleFavorite={onToggleFavorite}
                  onTrash={onTrash}
                  onRestore={onRestore}
                  onPermanentDelete={onPermanentDelete}
                  isTrashView={isTrashView}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
