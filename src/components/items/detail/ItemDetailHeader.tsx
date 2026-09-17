import React, { useState } from 'react';
import {
  ArrowLeft,
  Download,
  RotateCcw,
  Trash2,
  Star,
  Archive,
} from 'lucide-react';
import { Item } from '../../../types/item';
import { formatDisplayDate } from '../../../utils/dateUtils';
import { ConfirmModal } from '../../common/ConfirmModal';

interface ItemDetailHeaderProps {
  item: Item;
  hasFiles: boolean;
  activeMeta: {
    extension: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  };
  activePreviewUrl: string | null;
  onClose: () => void;
  onDownloadAttachment: () => void;
  onRestore?: (id: string) => void;
  onPermanentDelete?: (id: string) => void;
  onTrash?: (id: string) => void;
  onToggleFavorite: () => void;
  onToggleArchive: () => void;
}

export const ItemDetailHeader: React.FC<ItemDetailHeaderProps> = ({
  item,
  hasFiles,
  activeMeta,
  activePreviewUrl,
  onClose,
  onDownloadAttachment,
  onRestore,
  onPermanentDelete,
  onTrash,
  onToggleFavorite,
  onToggleArchive,
}) => {
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  return (
    <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-white/[0.08]">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-200 dark:border-white/[0.08] transition-colors cursor-pointer shadow-2xs"
          title="Back to workspace (Esc)"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
          <kbd className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-white/[0.08] text-slate-500 dark:text-zinc-400 font-mono">
            Esc
          </kbd>
        </button>

        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide uppercase border ${
              hasFiles
                ? `${activeMeta.badgeBg} ${activeMeta.badgeText} ${activeMeta.badgeBorder}`
                : 'bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/[0.08]'
            }`}
          >
            {hasFiles ? activeMeta.extension : item.type}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono hidden sm:inline-block">
            Created {formatDisplayDate(item.createdAt)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {hasFiles && activePreviewUrl && (
          <button
            type="button"
            onClick={onDownloadAttachment}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/[0.08] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Download file"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </button>
        )}

        {item.deletedAt ? (
          <>
            <button
              type="button"
              onClick={() => {
                if (onRestore) onRestore(item.id);
                onClose();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Restore to Inbox"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore</span>
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmDeleteOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Delete Permanently"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            <ConfirmModal
              isOpen={isConfirmDeleteOpen}
              onClose={() => setIsConfirmDeleteOpen(false)}
              onConfirm={() => {
                setIsConfirmDeleteOpen(false);
                if (onPermanentDelete) onPermanentDelete(item.id);
                onClose();
              }}
              title="Delete Permanently?"
              message="This item and its attachments will be permanently purged from your SQLite database. This action cannot be undone."
              confirmText="Delete Forever"
              variant="danger"
            />
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onToggleFavorite}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                item.favorite
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-500 border-amber-200 dark:border-amber-800/60'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-white/[0.08]'
              }`}
              title={item.favorite ? 'Remove from Pinned' : 'Pin to Top'}
            >
              <Star className={`w-3.5 h-3.5 ${item.favorite ? 'fill-current' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onToggleArchive}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                item.archived
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/60'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-white/[0.08]'
              }`}
              title={item.archived ? 'Unarchive' : 'Archive'}
            >
              <Archive className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (onTrash) onTrash(item.id);
                onClose();
              }}
              className="p-2 rounded-lg bg-slate-100 hover:bg-red-50 dark:bg-white/[0.06] dark:hover:bg-red-950/40 text-slate-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 border border-slate-200 dark:border-white/[0.08] transition-colors cursor-pointer"
              title="Move to Trash"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
