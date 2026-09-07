import React from 'react';
import {
  Sparkles,
  Zap,
  Trash2,
  X,
} from 'lucide-react';
import { useSelectionStore } from '../../stores/selectionStore';
import { useContextStore, itemToStagedItem } from '../../stores/contextStore';
import { useItemStore } from '../../stores/itemStore';
import { Item } from '../../types/item';

interface SelectionActionBarProps {
  items: Item[];
  onOpenFoundry?: () => void;
  onFocusChat?: () => void;
}

export const SelectionActionBar: React.FC<SelectionActionBarProps> = ({
  items,
  onOpenFoundry,
  onFocusChat,
}) => {
  const { selectedIds, clearSelection } = useSelectionStore();
  const { addChatContextItems, addFoundryItems } = useContextStore();
  const { notify, trashItem } = useItemStore();

  const selectedCount = selectedIds.size;
  if (selectedCount === 0) return null;

  const selectedItems = items.filter((item) => selectedIds.has(item.id));

  const handleAddToChatContext = () => {
    if (selectedItems.length === 0) return;
    const staged = selectedItems.map(itemToStagedItem);
    addChatContextItems(staged);
    notify(`Added ${staged.length} item${staged.length > 1 ? 's' : ''} to AI Chat context`, 'success');
    clearSelection();
    if (onFocusChat) {
      onFocusChat();
    }
  };

  const handleSendToFoundry = () => {
    if (selectedItems.length === 0) return;
    const staged = selectedItems.map(itemToStagedItem);
    addFoundryItems(staged);
    notify(`Sent ${staged.length} item${staged.length > 1 ? 's' : ''} to The Foundry`, 'success');
    clearSelection();
    if (onOpenFoundry) {
      onOpenFoundry();
    }
  };

  const handleBatchTrash = async () => {
    if (selectedItems.length === 0) return;
    const count = selectedItems.length;
    for (const item of selectedItems) {
      await trashItem(item.id);
    }
    notify(`Moved ${count} item${count > 1 ? 's' : ''} to Trash`, 'info');
    clearSelection();
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 view-enter">
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-md text-white shadow-2xl border border-slate-800 ring-1 ring-white/10 text-xs font-medium">
        {/* Counter Badge */}
        <div className="flex items-center gap-2 pr-2 border-r border-slate-700/80">
          <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-bold">
            {selectedCount}
          </div>
          <span className="font-semibold text-slate-200">
            {selectedCount} selected
          </span>
        </div>

        {/* Action 1: Add to AI Chat Context */}
        <button
          onClick={handleAddToChatContext}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all cursor-pointer shadow-xs hover:shadow-indigo-500/25"
          title="Add selected items to Landing AI Chat Context"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Add to Chat Context</span>
        </button>

        {/* Action 2: Send to The Foundry */}
        <button
          onClick={handleSendToFoundry}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700/80 transition-all cursor-pointer"
          title="Send selected items to The Foundry for synthesis"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>The Foundry</span>
        </button>

        {/* Action 3: Move to Trash */}
        <button
          onClick={handleBatchTrash}
          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
          title="Move selected items to Trash"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Action 4: Clear Selection */}
        <button
          onClick={clearSelection}
          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
