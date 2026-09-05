import React from 'react';
import { Item } from '../../types/item';
import { ItemCard } from '../../components/items/ItemCard';

interface ArchiveViewProps {
  items: Item[];
  onSelect: (item: Item) => void;
  onToggleFavorite: (itemId: string) => void;
  onTrash: (itemId: string) => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({
  items,
  onSelect,
  onToggleFavorite,
  onTrash,
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="space-y-3">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          Archived Items ({items.length})
        </div>

        <div className="space-y-2.5">
          {items.length === 0 ? (
            <div className="text-center py-16 text-xs text-slate-400">
              No archived items.
            </div>
          ) : (
            items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onSelect={onSelect}
                onToggleFavorite={onToggleFavorite}
                onTrash={onTrash}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
