import React from 'react';
import { UniversalCapture } from '../../components/capture/UniversalCapture';
import { ItemList } from '../../components/items/ItemList';
import { Item, CreateItemInput } from '../../types/item';

interface InboxViewProps {
  items: Item[];
  onCapture: (input: CreateItemInput) => Promise<any>;
  onSelect: (item: Item) => void;
  onToggleTask: (itemId: string, completed: boolean) => void;
  onToggleFavorite: (itemId: string) => void;
  onTrash: (itemId: string) => void;
}

export const InboxView: React.FC<InboxViewProps> = ({
  items,
  onCapture,
  onSelect,
  onToggleTask,
  onToggleFavorite,
  onTrash,
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Universal Hero Capture */}
      <div>
        <UniversalCapture onCapture={onCapture} />
      </div>

      {/* Recent Items Stream */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Recent Items ({items.length})
          </h2>
        </div>

        <ItemList
          items={items}
          onSelect={onSelect}
          onToggleTask={onToggleTask}
          onToggleFavorite={onToggleFavorite}
          onTrash={onTrash}
          emptyMessage="Your inbox is empty"
        />
      </div>
    </div>
  );
};
