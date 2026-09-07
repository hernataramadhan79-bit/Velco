import React, { useState } from 'react';
import { Item } from '../../types/item';
import { ItemCard } from './ItemCard';
import { Inbox, ChevronDown, ChevronRight } from 'lucide-react';
import { useSelectionStore } from '../../stores/selectionStore';

interface ItemListProps {
  items: Item[];
  onSelect: (item: Item) => void;
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
    thisWeek: true,
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
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center view-enter">
        {/* Illustrated icon */}
        <div className="relative mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 flex items-center justify-center text-blue-400 dark:text-blue-500 border border-blue-100/80 dark:border-blue-900/50 shadow-sm">
            <Inbox className="w-7 h-7" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center">
            <span className="text-[10px]">✨</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
          {emptyMessage}
        </h3>

        {/* Description */}
        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
          Capture thoughts, tasks, links, or drop files above.
          <br />
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono border border-slate-200 dark:border-slate-700">Ctrl+K</kbd> to search or drag files anywhere to import.
          </span>
        </p>
      </div>
    );
  }

  const renderSelectionBar = () => {
    if (!someSelectedInList) return null;
    return (
      <div className="flex items-center justify-between px-3 py-2 text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/70 dark:border-indigo-800/70 mb-3 shadow-2xs">
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
            className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 cursor-pointer"
          />
          <span className="text-[11px]">
            {allSelectedInList ? 'All items in this list selected' : `Select all ${items.length} items`}
          </span>
        </label>
        <button
          type="button"
          onClick={clearSelection}
          className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium cursor-pointer"
        >
          Deselect
        </button>
      </div>
    );
  };

  // If date grouping is not requested, render standard flat list
  if (!groupByDate) {
    return (
      <div className="space-y-2.5 w-full min-w-0">
        {renderSelectionBar()}
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onSelect={onSelect}
            onToggleTask={onToggleTask}
            onToggleFavorite={onToggleFavorite}
            onTrash={onTrash}
            onRestore={onRestore}
            onPermanentDelete={onPermanentDelete}
            isTrashView={isTrashView}
          />
        ))}
      </div>
    );
  }

  // Group items by date buckets: Today, Yesterday, This Week, Earlier
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfThisWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const grouped: {
    key: string;
    title: string;
    items: Item[];
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
    const itemTime = new Date(item.createdAt).getTime();
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
          <div key={group.key} className="space-y-2">
            {/* Accordion Group Header */}
            <button
              onClick={() => toggleGroup(group.key)}
              className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-blue-500 transition-transform" />
                )}
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                  {group.title}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  {group.items.length}
                </span>
              </div>

              <span className="text-[11px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                {isCollapsed ? 'Click to expand' : 'Click to collapse'}
              </span>
            </button>

            {/* Accordion Content */}
            {!isCollapsed && (
              <div className="space-y-2.5 w-full min-w-0 transition-opacity duration-150">
                {group.items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onSelect={onSelect}
                    onToggleTask={onToggleTask}
                    onToggleFavorite={onToggleFavorite}
                    onTrash={onTrash}
                    onRestore={onRestore}
                    onPermanentDelete={onPermanentDelete}
                    isTrashView={isTrashView}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
