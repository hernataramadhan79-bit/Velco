import React, { useMemo } from 'react';
import { Item, ItemSummary } from '../../types/item';
import { ItemCard } from '../../components/items/ItemCard';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { EmptyState } from '../../components/common/EmptyState';
import { useItemStore } from "../../stores/itemStore";

interface TrashViewProps {
  onSelect: (item: ItemSummary) => void;
  onRestore: (itemId: string) => void;
  onPermanentDelete: (itemId: string) => void;
  onEmptyTrash: () => void;
}

export const TrashView: React.FC<TrashViewProps> = ({
  onSelect,
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
}) => {
  const trashItems = useItemStore((s) => s.trashItems);
  const rawItems = useItemStore((s) => s.items);

  const items = useMemo(() => {
    if (trashItems.length > 0) return trashItems;
    return rawItems.filter((i) => i.trashed);
  }, [trashItems, rawItems]);
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Trash Header Banner */}
      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            Items in Trash are preserved locally. You can restore them or delete them permanently.
          </span>
        </div>

        {items.length > 0 && (
          <button
            onClick={onEmptyTrash}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors cursor-pointer shrink-0 ml-4 shadow-2xs"
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
            <EmptyState
              icon={Trash2}
              title="Trash is clean"
              description="Items deleted from your workstation will appear here before permanent removal."
              badgeIcon={Trash2}
            />
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
