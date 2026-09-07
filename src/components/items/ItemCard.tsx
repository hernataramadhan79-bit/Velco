import React from 'react';
import {
  FileText,
  CheckSquare,
  Link2,
  FileIcon,
  Image as ImageIcon,
  Star,
  Trash2,
  ExternalLink,
  Sparkles,
  Paperclip,
  Calendar,
  Clock,
  AlertCircle,
  Check,
  Archive,
  Zap,
} from 'lucide-react';
import { Item } from '../../types/item';
import { Badge } from '../common/Badge';
import { useContextStore, itemToStagedItem } from '../../stores/contextStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { formatTaskDueDate } from '../../utils/dateUtils';

interface ItemCardProps {
  item: Item;
  onSelect: (item: Item) => void;
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
        return <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'link':
        return <Link2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'file':
        return <FileIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'note':
      default:
        return <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'red';
      case 'high':
        return 'amber';
      case 'low':
        return 'gray';
      default:
        return 'blue';
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

  return (
    <div
      onClick={() => onSelect(item)}
      className={`group relative rounded-xl p-4 transition-all duration-150 cursor-pointer select-none border w-full min-w-0 overflow-hidden ${
        isSelected
          ? 'bg-indigo-50/50 dark:bg-indigo-950/35 border-indigo-500/90 ring-2 ring-indigo-500/25 shadow-xs'
          : isChatContext
          ? 'bg-indigo-50/20 dark:bg-indigo-950/15 border-indigo-200/80 dark:border-indigo-800/80 hover:bg-slate-50/90 dark:hover:bg-slate-800/90 shadow-2xs hover:shadow-xs'
          : 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 border-slate-200/90 dark:border-slate-800 shadow-2xs hover:shadow-xs'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* 1. Dedicated Selection Checkbox (Visible on hover or when items are selected) */}
          {!isTrashView && (
            <button
              type="button"
              onClick={handleSelectionClick}
              aria-label={isSelected ? 'Deselect item' : 'Select item'}
              className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                isSelected
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                  : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 bg-white dark:bg-slate-800 text-transparent opacity-0 group-hover:opacity-100'
              } ${hasAnySelection ? 'opacity-100' : ''}`}
              title={isSelected ? 'Deselect item' : 'Select item for batch actions'}
            >
              <Check className={`w-3 h-3 stroke-[3] ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          )}

          {/* 2. Consistent Type Logo for ALL items */}
          <div className="mt-0.5 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 shrink-0">
            {getTypeIcon()}
          </div>

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
                  className={`p-0.5 rounded-full border transition-all cursor-pointer shrink-0 ${
                    item.task?.completed
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-slate-300 dark:border-slate-600 hover:border-emerald-500 text-transparent hover:text-emerald-500/40'
                  }`}
                  title={item.task?.completed ? 'Mark task as pending' : 'Mark task as completed'}
                >
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </button>
              )}

              <h3
                className={`text-sm font-semibold truncate ${
                  item.type === 'task' && item.task?.completed
                    ? 'line-through text-slate-400 dark:text-slate-500'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {item.title}
              </h3>

              {item.type === 'task' && item.task?.priority && (
                <Badge variant={getPriorityVariant(item.task.priority)}>
                  {item.task.priority}
                </Badge>
              )}

              {item.aiMetadata?.summary && (
                <span title="AI Summary Available">
                  <Sparkles className="w-3 h-3 text-purple-500 shrink-0" />
                </span>
              )}
            </div>

            {/* Snippet / preview */}
            {item.content && item.content !== item.title && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                {item.content.replace(/^[#*-]\s+/gm, '')}
              </p>
            )}

            {/* Link Preview info */}
            {item.type === 'link' && item.link && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                <ExternalLink className="w-3 h-3" />
                <span className="font-mono text-[11px] truncate">{item.link.domain || item.link.url}</span>
              </div>
            )}

            {/* Visual preview for images & attachments */}
            {item.attachments && item.attachments.length > 0 && (
              <div className="mt-2.5 space-y-2">
                {/* Visual thumbnail for images */}
                {(() => {
                  const imageAtt = item.attachments.find(
                    (a) => a.dataUrl && (a.mimeType.startsWith('image/') || a.fileName.match(/\.(png|jpe?g|webp|gif|svg)$/i))
                  );
                  if (imageAtt?.dataUrl) {
                    return (
                      <div className="rounded-xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 max-h-48">
                        <img
                          src={imageAtt.dataUrl}
                          alt={imageAtt.fileName}
                          className="w-full max-h-48 object-cover hover:scale-102 transition-transform duration-200"
                          loading="lazy"
                        />
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* File badge list */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                  {item.attachments.map((att, idx) => (
                    <div
                      key={att.id || idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-[11px]"
                    >
                      {att.mimeType.startsWith('image/') ? (
                        <ImageIcon className="w-3.5 h-3.5 text-purple-500" />
                      ) : (
                        <Paperclip className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      <span className="font-medium truncate max-w-[140px]">{att.fileName}</span>
                      {att.fileSize > 0 && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({(att.fileSize / 1024).toFixed(0)}KB)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Task Due Date & Tags row */}
            {((item.tags && item.tags.length > 0) || (item.type === 'task' && item.task?.dueDate)) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                {/* Due Date Badge */}
                {item.type === 'task' && item.task?.dueDate && (() => {
                  const dueInfo = formatTaskDueDate(item.task.dueDate, item.task.completed);
                  if (dueInfo.status === 'none') return null;

                  return (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                        item.task?.completed
                          ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 line-through'
                          : dueInfo.status === 'overdue'
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold border border-rose-200/80 dark:border-rose-800/80'
                          : dueInfo.status === 'today'
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 font-semibold border border-amber-200/80 dark:border-amber-800/80'
                          : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60'
                      }`}
                      title={`Due Date: ${dueInfo.fullDateStr}`}
                    >
                      {item.task?.completed ? (
                        <Check className="w-2.5 h-2.5 text-slate-400" />
                      ) : dueInfo.status === 'overdue' ? (
                        <AlertCircle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                      ) : dueInfo.hasTime ? (
                        <Clock className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                      ) : (
                        <Calendar className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                      )}
                      <span>{dueInfo.label}</span>
                    </span>
                  );
                })()}

                {/* Tags */}
                {item.tags?.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Context Indicators, Date, & Quick Actions */}
        <div className="flex flex-col items-end justify-between self-stretch shrink-0 gap-2">
          <div className="flex items-center gap-1.5">
            {/* Active Context Badges */}
            {isChatContext && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80"
                title="Active in Landing AI Chat Context"
              >
                <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
                <span>Chat</span>
              </span>
            )}

            {isFoundryStaged && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80"
                title="Active in The Foundry Staging"
              >
                <Zap className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                <span>Foundry</span>
              </span>
            )}

            <div className="text-[11px] text-slate-400 font-mono">{formattedDate}</div>
          </div>

          {/* Quick Context / Item Action Buttons (revealed on hover) */}
          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            {!isTrashView ? (
              <>
                {/* 1-Click Quick Toggle for AI Chat Context */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleChatContextItem(itemToStagedItem(item));
                  }}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    isChatContext
                      ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60'
                      : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title={isChatContext ? 'Remove from AI Chat Context' : 'Attach to AI Chat Context'}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>

                {/* 1-Click Quick Toggle for The Foundry Context */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFoundryItem(itemToStagedItem(item));
                  }}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    isFoundryStaged
                      ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60'
                      : 'text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title={isFoundryStaged ? 'Remove from The Foundry' : 'Send to The Foundry'}
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
                    className="p-1 rounded-md text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title={item.favorite ? 'Unfavorite' : 'Favorite'}
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        item.favorite ? 'fill-amber-400 text-amber-500' : ''
                      }`}
                    />
                  </button>
                )}

                {onToggleArchive && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleArchive(item.id);
                    }}
                    className={`p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                      item.archived
                        ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700'
                        : 'text-slate-400 hover:text-blue-500'
                    }`}
                    title={item.archived ? 'Unarchive' : 'Archive'}
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                )}

                {onTrash && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrash(item.id);
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Move to Trash"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
                    className="px-2 py-0.5 rounded-md text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                  >
                    Restore
                  </button>
                )}
                {onPermanentDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPermanentDelete(item.id);
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Delete permanently"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
