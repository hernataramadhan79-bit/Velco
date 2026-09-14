import React from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import { Item, Tag, PriorityLevel } from '../../../types/item';
import { DueDatePicker } from '../../tasks/DueDatePicker';
import { ItemTagsEditor } from '../ItemTagsEditor';
import { TagRecommendationBar } from '../TagRecommendationBar';
import { openExternalUrl } from '../../../utils/urlUtils';
import { TagRecommendation } from '../../../services/ai/taskExtractor';

interface ItemDetailMetaBarProps {
  item: Item;
  isEditing: boolean;
  title: string;
  allTags: Tag[];
  isTagRecOpen: boolean;
  tagRecommendations: TagRecommendation[];
  aiEnabled: boolean;
  isAiLoading: boolean;
  onTitleChange: (val: string) => void;
  onSaveEdit: () => void;
  onStartEdit: () => void;
  onUpdate: (id: string, updates: Partial<Item>) => Promise<void>;
  onCreateTag: (name: string) => Promise<Tag>;
  onApplyRecommendedTags: (chosen: TagRecommendation[]) => Promise<void>;
  onDismissTagRec: () => void;
  onRunAiTags: () => void;
}

export const ItemDetailMetaBar: React.FC<ItemDetailMetaBarProps> = ({
  item,
  isEditing,
  title,
  allTags,
  isTagRecOpen,
  tagRecommendations,
  aiEnabled,
  isAiLoading,
  onTitleChange,
  onSaveEdit,
  onStartEdit,
  onUpdate,
  onCreateTag,
  onApplyRecommendedTags,
  onDismissTagRec,
  onRunAiTags,
}) => {
  return (
    <div className="space-y-3.5">
      {/* ── Title Bar ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="w-full px-3 py-1.5 text-base font-bold rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-300 dark:border-white/[0.1] text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          ) : (
            <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100 tracking-tight leading-snug break-words">
              {item.title}
            </h2>
          )}
        </div>

        <button
          onClick={() => (isEditing ? onSaveEdit() : onStartEdit())}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/[0.08] transition-colors cursor-pointer shrink-0"
        >
          {isEditing ? 'Done' : 'Edit Title'}
        </button>
      </div>

      {/* ── Task Settings Bar ── */}
      {item.type === 'task' && (
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 font-semibold cursor-pointer text-slate-800 dark:text-zinc-200 text-xs">
            <input
              type="checkbox"
              checked={item.task?.completed || false}
              onChange={(e) =>
                onUpdate(item.id, {
                  task: {
                    ...(item.task || { priority: 'medium' }),
                    completed: e.target.checked,
                    completedAt: e.target.checked ? new Date().toISOString() : null,
                  },
                })
              }
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-zinc-700 bg-white dark:bg-[#141418]"
            />
            <span className={item.task?.completed ? 'line-through text-slate-400 dark:text-zinc-500' : ''}>
              {item.task?.completed ? 'Task Completed' : 'Pending Task'}
            </span>
          </label>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 dark:text-zinc-500 text-[11px]">Priority:</span>
              {(['low', 'medium', 'high', 'urgent'] as PriorityLevel[]).map((p) => {
                const active = (item.task?.priority || 'medium') === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      onUpdate(item.id, {
                        task: {
                          ...(item.task || { completed: false }),
                          priority: p,
                        },
                      })
                    }
                    className={`px-2 py-0.5 rounded-md capitalize text-[11px] font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                        : 'bg-slate-200/70 hover:bg-slate-300/70 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <DueDatePicker
              taskId={item.id}
              value={item.task?.dueDate || ''}
              onChange={(newDueDate) =>
                onUpdate(item.id, {
                  task: {
                    ...(item.task || { priority: 'medium', completed: false }),
                    dueDate: newDueDate || null,
                  },
                })
              }
            />
          </div>
        </div>
      )}

      {/* ── Link Preview Row ── */}
      {item.type === 'link' && item.link && (
        <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-blue-900 dark:text-blue-200 truncate">
              {item.link.pageTitle || item.link.url}
            </div>
            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-mono truncate">
              {item.link.url}
            </div>
          </div>
          <button
            type="button"
            onClick={() => openExternalUrl(item.link!.url)}
            className="ml-3 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
          >
            <span>Open in Browser</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ── AI Tag Recommendations Bar ── */}
      {isTagRecOpen && tagRecommendations.length > 0 && (
        <TagRecommendationBar
          recommendations={tagRecommendations}
          onApply={onApplyRecommendedTags}
          onDismiss={onDismissTagRec}
        />
      )}

      {/* ── Tags Editor Bar ── */}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <ItemTagsEditor
          itemTags={item.tags || []}
          allTags={allTags}
          onAddTag={(tagId) => {
            const tag = allTags.find((t) => t.id === tagId);
            if (tag && !item.tags.some((t) => t.id === tagId)) {
              onUpdate(item.id, { tags: [...item.tags, tag] });
            }
          }}
          onRemoveTag={(tagId) => {
            onUpdate(item.id, { tags: item.tags.filter((t) => t.id !== tagId) });
          }}
          onCreateTag={onCreateTag}
        />
        {aiEnabled && !isTagRecOpen && (
          <button
            type="button"
            onClick={onRunAiTags}
            disabled={isAiLoading}
            className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 py-1 px-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
          >
            <Sparkles className="w-3 h-3" />
            <span>AI Suggest Tags</span>
          </button>
        )}
      </div>
    </div>
  );
};
