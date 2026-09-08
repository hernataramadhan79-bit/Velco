import React from 'react';
import {
  FileText,
  Eye,
  Star,
  Trash2,
  Check,
} from 'lucide-react';
import { ItemSummary } from '../../types/item';
import { getFileTypeMeta, extractSizeFromContent } from '../../utils/fileUtils';
import { useSelectionStore } from '../../stores/selectionStore';

interface FileListRowProps {
  item: ItemSummary;
  onSelect: (item: ItemSummary) => void;
  onQuickPreview: (item: ItemSummary) => void;
  onToggleFavorite?: (itemId: string) => void;
  onTrash?: (itemId: string) => void;
}

export const FileListRow: React.FC<FileListRowProps> = ({
  item,
  onSelect,
  onQuickPreview,
  onToggleFavorite,
  onTrash,
}) => {
  const isSelected = useSelectionStore((state) => state.isItemSelected(item.id));
  const toggleSelectItem = useSelectionStore((state) => state.toggleSelectItem);
  const selectedCount = useSelectionStore((state) => state.selectedIds.size);
  const hasAnySelection = selectedCount > 0;

  const [imgError, setImgError] = React.useState(false);
  const meta = getFileTypeMeta(item.title);
  const thumbnail =
    item.thumbnailUrl && item.thumbnailUrl.trim() !== ''
      ? item.thumbnailUrl
      : item.attachments?.find((a) => a.dataUrl && a.dataUrl.trim() !== '')?.dataUrl || null;
  const isImage = (meta.category === 'image' || item.type === 'image') && !!thumbnail && !imgError;
  const contentSize = extractSizeFromContent(item.content || item.excerpt);

  const formattedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const handleSelectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSelectItem(item.id);
  };

  const handleQuickPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    onQuickPreview(item);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) onToggleFavorite(item.id);
  };

  const handleTrashClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTrash) onTrash(item.id);
  };

  return (
    <div
      onClick={() => onSelect(item)}
      className={`group relative flex items-center justify-between p-2.5 px-3 rounded-xl border transition-all duration-150 cursor-pointer select-none bg-white dark:bg-[#141418] ${
        isSelected
          ? 'border-blue-400 dark:border-white/[0.2] bg-blue-50/50 dark:bg-white/[0.05] ring-1 ring-blue-500/20'
          : 'border-slate-200 dark:border-white/[0.07] hover:border-slate-300 dark:hover:border-white/[0.14] hover:bg-slate-50 dark:hover:bg-[#18181e]'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
        {/* Selection Checkbox */}
        <button
          type="button"
          onClick={handleSelectionClick}
          aria-label={isSelected ? 'Deselect item' : 'Select item'}
          className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-all shrink-0 ${
            isSelected
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'border-slate-300 dark:border-white/[0.15] bg-white dark:bg-[#101014] text-transparent opacity-0 group-hover:opacity-100'
          } ${hasAnySelection ? 'opacity-100' : ''}`}
        >
          <Check className={`w-2.5 h-2.5 stroke-[3] ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
        </button>

        {/* 40x40 Thumbnail or File Icon Avatar */}
        <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-[#0e0e12] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center shrink-0">
          {isImage ? (
            <img
              src={thumbnail!}
              alt={item.title}
              loading="lazy"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <div
              className={`w-full h-full flex items-center justify-center ${meta.iconBg} ${meta.iconColor}`}
            >
              <FileText className="w-5 h-5 stroke-[1.5]" />
            </div>
          )}
        </div>

        {/* Name and Meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4
              className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
              title={item.title}
            >
              {item.title}
            </h4>
            <span
              className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase shrink-0 border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
            >
              {meta.extension}
            </span>
          </div>

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-0.5">
              {item.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500 dark:text-zinc-400"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span>#{tag.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side: Size, Date, Actions */}
      <div className="flex items-center gap-4 shrink-0 font-mono text-xs text-slate-500 dark:text-zinc-400">
        <span className="w-20 text-right hidden sm:inline-block">
          {contentSize || (item.attachmentsCount ? `${item.attachmentsCount} file` : '1 file')}
        </span>

        <span className="w-24 text-right text-[11px] text-slate-400 dark:text-zinc-500 hidden md:inline-block">
          {formattedDate}
        </span>

        {/* Actions (visible on hover or active) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleQuickPreview}
            title="Quick preview (Lightbox)"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          {onToggleFavorite && (
            <button
              type="button"
              onClick={handleFavoriteClick}
              title={item.pinned ? 'Remove favorite' : 'Add to favorite'}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.06] ${
                item.pinned
                  ? 'text-amber-500'
                  : 'text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${item.pinned ? 'fill-current' : ''}`} />
            </button>
          )}

          {onTrash && (
            <button
              type="button"
              onClick={handleTrashClick}
              title="Move to trash"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
