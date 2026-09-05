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
  Layers,
  Calendar,
  Clock,
  AlertCircle,
  Check,
} from 'lucide-react';
import { Item } from '../../types/item';
import { Badge } from '../common/Badge';
import { useContextStore, estimateTokens } from '../../stores/contextStore';
import { formatTaskDueDate } from '../../utils/dateUtils';

interface ItemCardProps {
  item: Item;
  onSelect: (item: Item) => void;
  onToggleTask?: (itemId: string, completed: boolean) => void;
  onToggleFavorite?: (itemId: string) => void;
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
  onTrash,
  onRestore,
  onPermanentDelete,
  isTrashView = false,
}) => {
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
        return <FileText className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
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

  const isStaged = useContextStore((state) => state.isStaged(item.id));
  const toggleStage = useContextStore((state) => state.toggleStage);

  const handleToggleStage = (e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    toggleStage({
      id: item.id,
      type: (item.type as any) || 'note',
      title: item.title,
      plainText: item.content || item.title,
      estimatedTokens: estimateTokens(`${item.title}\n\n${item.content || ''}`),
    });
  };

  return (
    <div
      onClick={() => onSelect(item)}
      className={`group relative rounded-xl p-4 transition-all duration-150 cursor-pointer select-none border ${
        isStaged
          ? 'bg-indigo-50/40 dark:bg-indigo-950/25 border-indigo-500/80 ring-2 ring-indigo-500/20 shadow-xs'
          : 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 border-slate-200/90 dark:border-slate-800 shadow-2xs hover:shadow-xs'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          {/* If it's a task, show interactive checkbox */}
          {item.type === 'task' && onToggleTask ? (
            <input
              type="checkbox"
              checked={item.task?.completed || false}
              onChange={(e) => {
                e.stopPropagation();
                onToggleTask(item.id, e.target.checked);
              }}
              className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer"
            />
          ) : (
            <div className="mt-0.5 p-1 rounded-md bg-slate-100 dark:bg-slate-800 shrink-0">
              {getTypeIcon()}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
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
                {/* 1. If there is an image, show visual thumbnail */}
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

                {/* 2. File badge list */}
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

        {/* Right column: Date, Context Cart Staging, & Quick Actions */}
        <div className="flex flex-col items-end justify-between self-stretch shrink-0">
          <div className="flex items-center gap-2">
            {!isTrashView && (
              <label
                onClick={(e) => e.stopPropagation()}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium cursor-pointer transition-all ${
                  isStaged
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 ring-1 ring-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 opacity-0 group-hover:opacity-100'
                }`}
                title={isStaged ? 'Staged in Context Cart (Click to remove)' : 'Stage into Context Cart'}
              >
                <input
                  type="checkbox"
                  checked={isStaged}
                  onChange={handleToggleStage}
                  className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                />
                <span className="text-[10px] uppercase font-semibold tracking-wider flex items-center gap-1">
                  <Layers className="w-2.5 h-2.5" />
                  {isStaged ? 'Staged' : 'Stage'}
                </span>
              </label>
            )}
            <div className="text-[11px] text-slate-400 font-mono">{formattedDate}</div>
          </div>

          {/* Action buttons (revealed on hover) */}
          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity mt-2">
            {!isTrashView ? (
              <>
                {onToggleFavorite && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(item.id);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-amber-500 transition-colors"
                    title={item.favorite ? 'Unfavorite' : 'Favorite'}
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        item.favorite ? 'fill-amber-400 text-amber-500' : ''
                      }`}
                    />
                  </button>
                )}
                {onTrash && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrash(item.id);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-red-500 transition-colors"
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestore(item.id);
                    }}
                    className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-medium"
                  >
                    Restore
                  </button>
                )}
                {onPermanentDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPermanentDelete(item.id);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-red-500 transition-colors"
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
