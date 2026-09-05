import React from 'react';
import { Item } from '../../types/item';
import { ItemCard } from './ItemCard';
import { Inbox, SearchX } from 'lucide-react';

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
}) => {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 mb-3 border border-slate-200/80 dark:border-slate-800">
          <Inbox className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
          {emptyMessage}
        </h3>
        <p className="text-xs text-slate-400 max-w-xs">
          Capture thoughts, tasks, links, or drop files above to start organizing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
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
};
