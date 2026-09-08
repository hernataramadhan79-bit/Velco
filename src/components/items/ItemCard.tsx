import React from 'react';
import {
  FileText,
  CheckSquare,
  Link2,
  Folder,
  Image as ImageIcon,
  Star,
  Trash2,
  ExternalLink,
  Paperclip,
  Calendar,
  Clock,
  AlertCircle,
  Check,
  Archive,
  Zap,
  RotateCcw,
  Bot,
} from 'lucide-react';
import { Item, ItemSummary } from '../../types/item';
import { useContextStore, itemToStagedItem } from '../../stores/contextStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { formatTaskDueDate } from '../../utils/dateUtils';

interface ItemCardProps {
  item: Item | ItemSummary;
  onSelect: (item: any) => void;
  onToggleTask?: (itemId: string, completed: boolean) => void;
  onToggleFavorite?: (itemId: string) => void;
  onToggleArchive?: (itemId: string) => void;
  onTrash?: (itemId: string) => void;
  onRestore?: (itemId: string) => void;
  onPermanentDelete?: (itemId: string) => void;
  isTrashView?: boolean;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  onSelect,
  onToggleTask,
  onToggleFavorite,
  onToggleArchive,
  onTrash,
  onRestore,
  onPermanentDelete,
  isTrashView = false,
}) => {
  // Global Selection state
  const isSelected = useSelectionStore((state) => state.isItemSelected(item.id));
  const toggleSelectItem = useSelectionStore((state) => state.toggleSelectItem);
  const selectedCount = useSelectionStore((state) => state.selectedIds.size);
  const hasAnySelection = selectedCount > 0;

  // Dual-channel context status
  const isChatContext = useContextStore((state) => state.isChatContext(item.id));
  const isFoundryStaged = useContextStore((state) => state.isFoundryStaged(item.id));
  const toggleChatContextItem = useContextStore((state) => state.toggleChatContextItem);
  const toggleFoundryItem = useContextStore((state) => state.toggleFoundryItem);

  const getTypeIcon = () => {
    switch (item.type) {
      case 'task':
        return <CheckSquare className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />;
      case 'link':
        return <Link2 className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />;
      case 'file':
        return <Folder className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />;
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />;
      case 'note':
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />;
    }
  };

  const formattedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  const handleSelectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSelectItem(item.id);
  };

  const [thumbError, setThumbError] = React.useState(false);

  const rawThumbnail =
    item.thumbnailUrl && item.thumbnailUrl.trim() !== ''
      ? item.thumbnailUrl
      : item.attachments?.find(
          (a) =>
            a.dataUrl &&
            a.dataUrl.trim() !== '' &&
            (a.mimeType?.startsWith('image/') ||
              a.fileName?.match(/\.(png|jpe?g|webp|gif|svg|bmp)$/i))
        )?.dataUrl ||
        (item.link?.previewImage && item.link.previewImage.trim() !== ''
          ? item.link.previewImage
          : null);

  const thumbnail = thumbError ? null : rawThumbnail;

  return (
    <div
      onClick={() => onSelect(item)}
      className={`group relative rounded-lg p-3.5 transition-all duration-150 cursor-pointer select-none border w-full min-w-0 overflow-hidden ${
        isSelected
          ? 'bg-blue-50/70 dark:bg-white/[0.08] border-blue-300 dark:border-white/[0.2] ring-1 ring-blue-400/30 dark:ring-white/[0.15] shadow-xs'
          : isChatContext || isFoundryStaged
          ? 'bg-white dark:bg-[#141418] border-slate-300 dark:border-white/[0.12] hover:bg-slate-50 dark:hover:bg-[#18181e] shadow-xs'
          : 'bg-white dark:bg-[#141418] hover:bg-slate-50 dark:hover:bg-[#18181e] border-slate-200 dark:border-white/[0.07] hover:border-slate-300 dark:hover:border-white/[0.14] shadow-2xs'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          {/* 1. Selection Checkbox */}
          {!isTrashView && (
            <button
              type="button"
              onClick={handleSelectionClick}
              aria-label={isSelected ? 'Deselect item' : 'Select item'}
              className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                isSelected
                  ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                  : 'border-slate-300 dark:border-white/[0.15] hover:border-slate-400 dark:hover:border-white/[0.3] bg-white dark:bg-[#101014] text-transparent opacity-0 group-hover:opacity-100'
              } ${hasAnySelection ? 'opacity-100' : ''}`}
            >
              <Check className={`w-2.5 h-2.5 stroke-[3] ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          )}

          {/* 2. Type Icon or Image Thumbnail */}
          {thumbnail ? (
            <div className="mt-0.5 w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-zinc-800 shrink-0 shadow-2xs">
              <img
                src={thumbnail}
                alt={item.title}
                loading="lazy"
                onError={() => setThumbError(true)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            </div>
          ) : (
            <div className="mt-0.5 p-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] shrink-0">
              {getTypeIcon()}
            </div>
          )}

          {/* 3. Main Content: Title, Priority, Snippets, Attachments */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* Task Completion Check Ring (Only for task items) */}
              {item.type === 'task' && onToggleTask && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTask(item.id, !item.task?.completed);
                  }}
                  className={`w-3.5 h-3.5 rounded border transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                    item.task?.completed
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-slate-300 dark:border-white/[0.2] hover:border-emerald-400 text-transparent'
                  }`}
                  title={item.task?.completed ? 'Mark task as pending' : 'Mark task as completed'}
                >
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </button>
              )}

              <h3
                className={`text-xs font-medium tracking-tight truncate ${
                  item.type === 'task' && item.task?.completed
                    ? 'line-through text-slate-400 dark:text-zinc-500'
                    : 'text-slate-900 dark:text-zinc-100'
                }`}
              >
                {item.title}
              </h3>

              {item.type === 'task' && item.task?.priority && item.task.priority !== 'medium' && (
                <span className="text-[10px] font-mono uppercase px-1 py-0.2 rounded bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.07] text-slate-600 dark:text-zinc-400">
                  {item.task.priority === 'urgent' ? 'P1' : item.task.priority === 'high' ? 'P2' : 'P3'}
                </span>
              )}
            </div>

            {/* Snippet / preview */}
            {(item.content || (item as any).excerpt) && (item.content || (item as any).excerpt) !== item.title && (
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                {(item.content || (item as any).excerpt).replace(/^[#*-]\s+/gm, '')}
              </p>
            )}

            {/* Link Preview info */}
            {item.type === 'link' && item.link && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                <ExternalLink className="w-3 h-3 stroke-[1.5]" />
                <span className="font-mono text-[11px] truncate">{item.link.domain || item.link.url}</span>
              </div>
            )}

            {/* Attachments Indicator */}
            {item.attachments && item.attachments.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-slate-500 dark:text-zinc-500">
                <Paperclip className="w-3 h-3 stroke-[1.5]" />
                <span>{item.attachments.length} attachment{item.attachments.length > 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Task Due Date & Tags row */}
            {((item.tags && item.tags.length > 0) || (item.type === 'task' && item.task?.dueDate)) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {/* Due Date Badge */}
                {item.type === 'task' && item.task?.dueDate && (() => {
                  const dueInfo = formatTaskDueDate(item.task.dueDate, item.task.completed);
                  if (dueInfo.status === 'none') return null;

                  return (
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        item.task?.completed
                          ? 'bg-slate-100 dark:bg-white/[0.04] text-slate-400 dark:text-zinc-500 line-through'
                          : dueInfo.status === 'overdue'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20'
                          : dueInfo.status === 'today'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20'
                          : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-white/[0.05] dark:text-zinc-300 dark:border-white/[0.08]'
                      }`}
                    >
                      {dueInfo.status === 'overdue' ? (
                        <AlertCircle className="w-2.5 h-2.5 text-rose-500 dark:text-rose-400" />
                      ) : dueInfo.hasTime ? (
                        <Clock className="w-2.5 h-2.5 text-amber-500 dark:text-amber-400" />
                      ) : (
                        <Calendar className="w-2.5 h-2.5 text-slate-400 dark:text-zinc-400" />
                      )}
                      <span>{dueInfo.label}</span>
                    </span>
                  );
                })()}

                {/* Tags */}
                {item.tags?.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.05] text-slate-600 dark:text-zinc-400"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span>#{tag.name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Badges & Actions (Hover revealed) */}
        <div className="flex flex-col items-end justify-between self-stretch shrink-0 gap-2">
          <div className="flex items-center gap-1.5">
            {isChatContext && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-300">
                Chat
              </span>
            )}
            {isFoundryStaged && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300">
                Workbench
              </span>
            )}
            <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">{formattedDate}</div>
          </div>

          {/* Quick Actions Bar (Revealed on hover) */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {!isTrashView ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleChatContextItem(itemToStagedItem(item));
                  }}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    isChatContext
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-500/15'
                      : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-white/[0.05]'
                  }`}
                  title={isChatContext ? 'Remove from Chat Context' : 'Add to Chat Context'}
                >
                  <Bot className="w-3.5 h-3.5 stroke-[1.5]" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFoundryItem(itemToStagedItem(item));
                  }}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    isFoundryStaged
                      ? 'text-amber-500 dark:text-amber-400 bg-amber-500/15'
                      : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-white/[0.05]'
                  }`}
                  title={isFoundryStaged ? 'Remove from Workbench' : 'Add to Workbench'}
                >
                  <Zap className={`w-3.5 h-3.5 ${isFoundryStaged ? 'fill-current' : ''}`} />
                </button>

                {onToggleFavorite && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(item.id);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-amber-400 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                    title={(item as any).favorite || (item as ItemSummary).pinned ? 'Unfavorite' : 'Favorite'}
                  >
                    <Star className={`w-3.5 h-3.5 ${(item as any).favorite || (item as ItemSummary).pinned ? 'fill-amber-400 text-amber-500' : ''}`} />
                  </button>
                )}

                {onToggleArchive && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleArchive(item.id);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                    title="Archive item"
                  >
                    <Archive className="w-3.5 h-3.5 stroke-[1.5]" />
                  </button>
                )}

                {onTrash && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrash(item.id);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:text-zinc-500 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Move to trash"
                  >
                    <Trash2 className="w-3.5 h-3.5 stroke-[1.5]" />
                  </button>
                )}
              </>
            ) : (
              <>
                {onRestore && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestore(item.id);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:text-zinc-500 dark:hover:text-emerald-400 dark:hover:bg-emerald-500/10 transition-colors cursor-pointer"
                    title="Restore item"
                  >
                    <RotateCcw className="w-3.5 h-3.5 stroke-[1.5]" />
                  </button>
                )}
                {onPermanentDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPermanentDelete(item.id);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:text-zinc-500 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Delete permanently"
                  >
                    <Trash2 className="w-3.5 h-3.5 stroke-[1.5]" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
