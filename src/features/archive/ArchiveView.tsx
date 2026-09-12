import React, { useMemo } from 'react';
import { Item, ItemSummary } from '../../types/item';
import { ItemCard } from '../../components/items/ItemCard';
import { Archive } from 'lucide-react';
import { EmptyState } from '../../components/common/EmptyState';
import { useItemStore } from "../../stores/itemStore";

interface ArchiveViewProps {
  onSelect: (item: ItemSummary) => void;
  onToggleFavorite: (itemId: string) => void;
  onTrash: (itemId: string) => void;
  onToggleArchive?: (itemId: string) => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({
  onSelect,
  onToggleFavorite,
  onTrash,
  onToggleArchive,
}) => {
  const archiveItems = useItemStore((s) => s.archiveItems);
  const rawItems = useItemStore((s) => s.items);

  const items = useMemo(() => {
    if (archiveItems.length > 0) return archiveItems;
    return rawItems.filter((i) => i.archived && !i.trashed);
  }, [archiveItems, rawItems]);
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="space-y-3">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          Archived Items ({items.length})
        </div>

        <div className="space-y-2.5">
          {items.length === 0 ? (
            <EmptyState
              icon={Archive}
              title="No archived items"
              description="Keep your active workspace tidy. Archived items stay fully searchable and can be restored anytime."
              badgeIcon={Archive}
            />
          ) : (
            items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onSelect={onSelect}
                onToggleFavorite={onToggleFavorite}
                onTrash={onTrash}
                onToggleArchive={onToggleArchive}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
