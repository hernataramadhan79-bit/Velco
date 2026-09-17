import React, { useState, useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import { Item, ItemSummary } from '../../types/item';
import { ItemCard } from './ItemCard';
import { Inbox, ChevronDown, ChevronRight } from 'lucide-react';
import { EmptyState } from '../common/EmptyState';
import { useSelectionStore } from '../../stores/selectionStore';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatShortcut } from '../../utils/platformUtils';

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
  emptyDescription?: React.ReactNode;
  emptyIcon?: React.ComponentType<{ className?: string }>;
  emptyAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ComponentType<{ className?: string }>;
  };
  groupByDate?: boolean;
}

export type VirtualRow =
  | {
      type: 'header';
      key: string;
      title: string;
      count: number;
      groupKey: string;
      isCollapsed: boolean;
    }
  | {
      type: 'item';
      key: string;
      data: Item | ItemSummary;
    };

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
  emptyDescription,
  emptyIcon,
  emptyAction,
  groupByDate = false,
}) => {
  const selectedIds = useSelectionStore((state) => state.selectedIds);
  const selectAll = useSelectionStore((state) => state.selectAll);
  const clearSelection = useSelectionStore((state) => state.clearSelection);

  const allIdsInList = useMemo(() => items.map((i) => i.id), [items]);
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

  const parentRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    if (!parentRef.current) return;
    const el = parentRef.current;
    const update = () => {
      const offset = el.offsetTop;
      setScrollMargin((prev) => (prev !== offset ? offset : prev));
    };
    update();
    // Re-measure if the container repositions (e.g. sidebar open/close)
    const observer = new ResizeObserver(update);
    const parent = el.closest('main') ?? el.parentElement;
    if (parent) observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  const getScrollElement = useCallback(() => {
    if (!parentRef.current) return null;
    return parentRef.current.closest('main') ?? parentRef.current;
  }, []);

  // Linearize items and group headers into a single flat VirtualRow array
  const virtualRows = useMemo<VirtualRow[]>(() => {
    if (!groupByDate) {
      return items.map((item) => ({
        type: 'item',
        key: item.id,
        data: item,
      }));
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOfThisWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

    const grouped: {
      key: string;
      title: string;
      items: (Item | ItemSummary)[];
    }[] = [
      { key: 'today', title: 'Today', items: [] },
      { key: 'yesterday', title: 'Yesterday', items: [] },
      { key: 'thisWeek', title: 'This Week', items: [] },
      { key: 'earlier', title: 'Earlier', items: [] },
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

    const rows: VirtualRow[] = [];
    grouped.forEach((group) => {
      if (group.items.length === 0) return;
      const isCollapsed = Boolean(collapsedGroups[group.key]);
      rows.push({
        type: 'header',
        key: `header-${group.key}`,
        title: group.title,
        count: group.items.length,
        groupKey: group.key,
        isCollapsed,
      });

      if (!isCollapsed) {
        group.items.forEach((item) => {
          rows.push({
            type: 'item',
            key: item.id,
            data: item,
          });
        });
      }
    });

    return rows;
  }, [items, groupByDate, collapsedGroups]);

  const rowVirtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement,
    estimateSize: (index) => (virtualRows[index]?.type === 'header' ? 36 : 82),
    overscan: 6,
    scrollMargin,
    initialRect: { width: 800, height: 800 },
    getItemKey: (index) => virtualRows[index]?.key ?? index,
  });

  if (items.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon || Inbox}
        title={emptyMessage}
        description={
          emptyDescription || (
            <>
              Capture notes, tasks, or drop attachments.
              <br />
              <span className="text-slate-600 dark:text-zinc-400">
                Press{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] text-[10px] text-slate-700 dark:text-zinc-300 font-mono">
                  {formatShortcut('K')}
                </kbd>{' '}
                to search.
              </span>
            </>
          )
        }
        action={emptyAction}
      />
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

  const virtualItems = rowVirtualizer.getVirtualItems();
  const effectiveMargin = rowVirtualizer.options.scrollMargin ?? 0;

  return (
    <div ref={parentRef} className="w-full min-w-0">
      {renderSelectionBar()}
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: 'relative',
          width: '100%',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const row = virtualRows[virtualRow.index];
          if (!row) return null;

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start - effectiveMargin}px)`,
              }}
            >
              {row.type === 'header' ? (
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(row.groupKey)}
                    className="w-full flex items-center justify-between py-1 px-1 rounded text-left group cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2">
                      {row.isCollapsed ? (
                        <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-slate-600 dark:text-zinc-500 dark:group-hover:text-zinc-300" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-slate-500 dark:text-zinc-400" />
                      )}
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 group-hover:text-slate-800 dark:text-zinc-500 dark:group-hover:text-zinc-300 font-semibold">
                        {row.title}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.04] text-slate-500 dark:text-zinc-500 border border-slate-200/60 dark:border-white/[0.04]">
                        {row.count}
                      </span>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="pb-2">
                  <ItemCard
                    item={row.data as Item}
                    onSelect={onSelect as any}
                    onToggleTask={onToggleTask}
                    onToggleFavorite={onToggleFavorite}
                    onTrash={onTrash}
                    onRestore={onRestore}
                    onPermanentDelete={onPermanentDelete}
                    isTrashView={isTrashView}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

