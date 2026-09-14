import React from 'react';
import { Paperclip, X, Search, Plus } from 'lucide-react';
import { ItemSummary } from '../../../types/item';

interface AttachItemModalProps {
  isOpen: boolean;
  attachSearchQuery: string;
  attachableItems: ItemSummary[];
  onSearchChange: (q: string) => void;
  onAttachItem: (item: ItemSummary) => void;
  onClose: () => void;
}

export const AttachItemModal: React.FC<AttachItemModalProps> = ({
  isOpen,
  attachSearchQuery,
  attachableItems,
  onSearchChange,
  onAttachItem,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 transform-gpu z-50 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-lg bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.08] p-5 space-y-3 shadow-2xl animate-in zoom-in-95 duration-100 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
              Attach from Workspace
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search notes and tasks to attach..."
            value={attachSearchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-1 min-h-[220px] max-h-[350px] p-1 border border-slate-100 dark:border-white/[0.04] rounded-lg">
          {attachableItems.map((item) => (
            <div
              key={item.id}
              className="p-2 rounded-md hover:bg-slate-50 dark:hover:bg-white/[0.04] flex items-center justify-between gap-3 text-xs transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase px-1 py-0.2 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-zinc-400">
                    {item.type}
                  </span>
                  <span className="font-medium text-slate-800 dark:text-zinc-200 truncate">
                    {item.title}
                  </span>
                </div>
                {item.excerpt && (
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate mt-0.5">
                    {item.excerpt}
                  </p>
                )}
              </div>

              <button
                onClick={() => onAttachItem(item)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-[11px] font-medium transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3 h-3" />
                <span>Attach</span>
              </button>
            </div>
          ))}

          {attachableItems.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-400 dark:text-zinc-600">
              {attachSearchQuery ? 'No matching items' : 'All workspace items are already attached'}
            </div>
          )}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 text-slate-700 dark:text-zinc-300 text-xs font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
