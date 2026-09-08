import React from 'react';
import {
  Layers,
  Zap,
  Trash2,
  X,
} from 'lucide-react';
import { useSelectionStore } from '../../stores/selectionStore';
import { useContextStore, itemToStagedItem } from '../../stores/contextStore';
import { useItemStore } from '../../stores/itemStore';
import { Item, ItemSummary } from '../../types/item';

interface SelectionActionBarProps {
  items: ItemSummary[];
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
    notify(`Added ${staged.length} item${staged.length > 1 ? 's' : ''} to Chat context`, 'success');
    clearSelection();
    if (onFocusChat) {
      onFocusChat();
    }
  };

  const handleSendToWorkbench = () => {
    if (selectedItems.length === 0) return;
    const staged = selectedItems.map(itemToStagedItem);
    addFoundryItems(staged);
    notify(`Staged ${staged.length} item${staged.length > 1 ? 's' : ''} to Workbench`, 'success');
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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 view-enter select-none">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/95 dark:bg-[#141418]/95 backdrop-blur-md text-slate-900 dark:text-zinc-100 shadow-2xl border border-slate-300 dark:border-white/[0.1] text-xs font-mono">
        {/* Counter Badge */}
        <div className="flex items-center gap-2 pr-2.5 border-r border-slate-200 dark:border-white/[0.08]">
          <span className="w-5 h-5 rounded bg-blue-500/20 dark:bg-blue-600/30 border border-blue-500/40 text-blue-600 dark:text-blue-300 flex items-center justify-center text-[10px] font-bold">
            {selectedCount}
          </span>
          <span className="text-slate-700 dark:text-zinc-300 text-[11px]">
            selected
          </span>
        </div>

        {/* Action 1: Add to AI Chat Context */}
        <button
          onClick={handleAddToChatContext}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.14] text-slate-800 dark:text-zinc-100 border border-slate-200 dark:border-white/[0.08] transition-all cursor-pointer shadow-xs text-xs font-medium"
          title="Attach selected items to Chat Context"
        >
          <Layers className="w-3.5 h-3.5 stroke-[1.5] text-blue-600 dark:text-blue-400" />
          <span>Chat Context</span>
        </button>

        {/* Action 2: Send to Workbench */}
        <button
          onClick={handleSendToWorkbench}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.14] text-slate-800 dark:text-zinc-100 border border-slate-200 dark:border-white/[0.08] transition-all cursor-pointer shadow-xs text-xs font-medium"
          title="Stage selected items to Studio Workbench for synthesis"
        >
          <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500 dark:fill-current" />
          <span>Workbench</span>
        </button>

        {/* Action 3: Move to Trash */}
        <button
          onClick={handleBatchTrash}
          className="p-1.5 rounded-md text-slate-400 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          title="Move selected items to Trash"
        >
          <Trash2 className="w-3.5 h-3.5 stroke-[1.5]" />
        </button>

        {/* Action 4: Clear Selection */}
        <button
          onClick={clearSelection}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer ml-0.5"
          title="Clear selection"
        >
          <X className="w-3.5 h-3.5 stroke-[1.5]" />
        </button>
      </div>
    </div>
  );
};
