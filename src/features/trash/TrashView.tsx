import React from 'react';
import { Item } from '../../types/item';
import { ItemCard } from '../../components/items/ItemCard';
import { AlertTriangle } from 'lucide-react';

interface TrashViewProps {
  items: Item[];
  onSelect: (item: Item) => void;
  onRestore: (itemId: string) => void;
  onPermanentDelete: (itemId: string) => void;
  onEmptyTrash: () => void;
}

export const TrashView: React.FC<TrashViewProps> = ({
  items,
  onSelect,
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Trash Header Banner */}
      <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Items in Trash are preserved locally. You can restore them or delete them permanently.
          </span>
        </div>

        {items.length > 0 && (
          <button
            onClick={onEmptyTrash}
            className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors cursor-pointer shrink-0 ml-4"
          >
            Empty Trash
          </button>
        )}
      </div>

      {/* Trash Items List */}
      <div className="space-y-3">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          Trash ({items.length})
        </div>

        <div className="space-y-2.5">
          {items.length === 0 ? (
            <div className="text-center py-16 text-xs text-slate-400">
              Trash is empty.
            </div>
          ) : (
            items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onSelect={onSelect}
                onRestore={onRestore}
                onPermanentDelete={onPermanentDelete}
                isTrashView={true}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
