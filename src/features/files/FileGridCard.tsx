import React from 'react';
import {
  FileText,
  Eye,
  Star,
  Trash2,
  Check,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';
import { ItemSummary } from '../../types/item';
import { getFileTypeMeta, extractSizeFromContent } from '../../utils/fileUtils';
import { useSelectionStore } from '../../stores/selectionStore';

interface FileGridCardProps {
  item: ItemSummary;
  onSelect: (item: ItemSummary) => void;
  onQuickPreview: (item: ItemSummary) => void;
  onToggleFavorite?: (itemId: string) => void;
  onTrash?: (itemId: string) => void;
}

export const FileGridCard: React.FC<FileGridCardProps> = ({
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

  const meta = getFileTypeMeta(item.title);
  const isImage = meta.category === 'image' && !!item.thumbnailUrl;
  const contentSize = extractSizeFromContent(item.content || item.excerpt);

  const formattedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
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
      className={`group relative flex flex-col rounded-xl overflow-hidden border transition-all duration-150 cursor-pointer select-none bg-white dark:bg-[#141418] ${
        isSelected
          ? 'border-blue-400 dark:border-white/[0.25] ring-2 ring-blue-500/20 shadow-md scale-[1.01]'
          : 'border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.18] hover:shadow-md'
      }`}
    >
      {/* ── Top Preview / Thumbnail Area ── */}
      <div className="relative w-full h-36 bg-slate-100 dark:bg-[#0e0e12] overflow-hidden flex items-center justify-center border-b border-slate-100 dark:border-white/[0.04]">
        {isImage ? (
          <img
            src={item.thumbnailUrl!}
            alt={item.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center mb-1.5 shadow-2xs ${meta.iconBg} ${meta.iconColor}`}
            >
              <FileText className="w-6 h-6 stroke-[1.5]" />
            </div>
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-zinc-500">
              {meta.extension}
            </span>
          </div>
        )}

        {/* Extension Badge (top-left) */}
        <div className="absolute top-2 left-2 z-10">
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider uppercase border shadow-2xs backdrop-blur-xs ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
          >
            {meta.extension}
          </span>
        </div>

        {/* Selection Checkbox (top-left next to badge or hover) */}
        <button
          type="button"
          onClick={handleSelectionClick}
          aria-label={isSelected ? 'Deselect item' : 'Select item'}
          className={`absolute top-2 right-2 z-10 w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer transition-all shadow-xs ${
            isSelected
              ? 'bg-blue-600 border-blue-600 text-white opacity-100'
              : 'border-slate-300 dark:border-white/[0.2] bg-white/90 dark:bg-black/70 hover:scale-105 text-transparent opacity-0 group-hover:opacity-100'
          } ${hasAnySelection ? 'opacity-100' : ''}`}
        >
          <Check className={`w-3 h-3 stroke-[3] ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
        </button>

        {/* Hover Quick Actions Overlay (bottom inside preview) */}
        <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            type="button"
            onClick={handleQuickPreview}
            title="Quick preview (Lightbox)"
            className="p-1 rounded-md bg-black/40 hover:bg-black/70 text-white transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          {onToggleFavorite && (
            <button
              type="button"
              onClick={handleFavoriteClick}
              title={item.pinned ? 'Remove favorite' : 'Add to favorite'}
              className={`p-1 rounded-md bg-black/40 hover:bg-black/70 transition-colors cursor-pointer ${
                item.pinned ? 'text-amber-400' : 'text-white'
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
              className="p-1 rounded-md bg-black/40 hover:bg-rose-600 text-white transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Bottom Metadata Area ── */}
      <div className="p-3 flex flex-col justify-between flex-1 gap-1.5">
        <div>
          <h4
            className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
            title={item.title}
          >
            {item.title}
          </h4>
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-zinc-500 pt-1 border-t border-slate-100 dark:border-white/[0.04]">
          <span className="truncate">
            {contentSize || (item.attachmentsCount ? `${item.attachmentsCount} file` : '1 file')}
          </span>
          <span className="shrink-0 text-[10px] text-slate-400 dark:text-zinc-500">
            {formattedDate}
          </span>
        </div>
      </div>
    </div>
  );
};
