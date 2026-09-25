import React, { useState, useEffect, useCallback } from 'react';
import { ListTodo, Link2, ArrowUpRight, CornerDownRight, FileText, CheckSquare, ExternalLink } from 'lucide-react';
import { Item, ItemLinksPayload } from '../../../types/item';
import { MarkdownViewer } from '../../common/MarkdownViewer';
import { db } from '../../../services/database';
import { useItemStore } from '../../../stores/itemStore';

interface ItemDetailContentTabProps {
  item: Item;
  hasFiles: boolean;
  isEditing: boolean;
  content: string;
  displayedNotes: string;
  aiEnabled: boolean;
  isAiLoading: boolean;
  onContentChange: (val: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onStartEdit: () => void;
  onExtractTasks: () => void;
}

export const ItemDetailContentTab: React.FC<ItemDetailContentTabProps> = ({
  item,
  hasFiles,
  isEditing,
  content,
  displayedNotes,
  aiEnabled,
  isAiLoading,
  onContentChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onExtractTasks,
}) => {
  const [linksPayload, setLinksPayload] = useState<ItemLinksPayload>({ outlinks: [], backlinks: [] });
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);

  // Fetch bidirectional links for this item
  useEffect(() => {
    let isMounted = true;
    setIsLoadingLinks(true);
    db.getItemLinks(item.id)
      .then((data) => {
        if (isMounted) {
          setLinksPayload(data);
        }
      })
      .catch((err) => {
        console.debug('Failed to fetch item links:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingLinks(false);
      });

    return () => {
      isMounted = false;
    };
  }, [item.id, item.updatedAt]);

  const handleWikilinkClick = useCallback((targetTitle: string) => {
    const store = useItemStore.getState();
    const cleanTarget = targetTitle.trim().toLowerCase();
    const found = store.items.find(
      (i) => i.title.trim().toLowerCase() === cleanTarget && !i.trashed
    );

    if (found) {
      store.setSelectedItemId(found.id);
    } else {
      store.notify(`Note "[[${targetTitle}]]" not found. Create it in Notes anytime!`, 'info');
    }
  }, []);

  const handleNavigateToItem = useCallback((targetId: string) => {
    useItemStore.getState().setSelectedItemId(targetId);
  }, []);

  return (
    <div className="space-y-4">
      {isEditing ? (
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          rows={7}
          className="w-full p-3 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-300 dark:border-white/[0.08] text-sm text-slate-900 dark:text-zinc-100 font-sans leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder={
            hasFiles
              ? 'Add custom notes, context, or description for this file... (use [[Note Title]] for wikilinks)'
              : 'Markdown notes or description... (use [[Note Title]] to link to other notes)'
          }
          autoFocus
        />
      ) : displayedNotes ? (
        <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-[#101014]/60 border border-slate-200/80 dark:border-white/[0.06] min-h-[70px] text-sm text-slate-800 dark:text-zinc-200 leading-relaxed">
          <MarkdownViewer content={displayedNotes} onWikilinkClick={handleWikilinkClick} />
        </div>
      ) : (
        <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-white/[0.08] text-center bg-slate-50/30 dark:bg-white/[0.02]">
          <p className="text-xs text-slate-400 dark:text-zinc-500 mb-2">
            No additional notes or description yet.
          </p>
          <button
            type="button"
            onClick={onStartEdit}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            Add Notes
          </button>
        </div>
      )}

      {/* Footer bar */}
      <div className="flex items-center justify-between pt-1">
        <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
          {displayedNotes ? `${displayedNotes.split(/\s+/).filter(Boolean).length} words` : '0 words'}
        </div>

        {isEditing ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-3 py-1.5 text-xs rounded-lg text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-white/[0.06] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSaveEdit}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-xs cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {aiEnabled && displayedNotes.trim() && item.type !== 'task' && (
              <button
                type="button"
                onClick={onExtractTasks}
                disabled={isAiLoading}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Extract discrete tasks from this note using AI"
              >
                <ListTodo className="w-3.5 h-3.5" />
                <span>Extract Tasks</span>
              </button>
            )}
            {displayedNotes && (
              <button
                type="button"
                onClick={onStartEdit}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/[0.08] transition-colors cursor-pointer"
              >
                Edit Notes
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Bidirectional Knowledge Graph / References (Backlinks & Outlinks) ── */}
      {(linksPayload.backlinks.length > 0 || linksPayload.outlinks.length > 0) && (
        <div className="pt-2 border-t border-slate-200/60 dark:border-white/[0.06] space-y-3">
          {/* Backlinks (Linked Mentions) */}
          {linksPayload.backlinks.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <CornerDownRight className="w-3 h-3 text-blue-500" />
                <span>Linked Mentions ({linksPayload.backlinks.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {linksPayload.backlinks.map((link) => (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => handleNavigateToItem(link.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/70 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 text-xs font-medium transition-all cursor-pointer shadow-2xs active:scale-95"
                    title={`Referenced by ${link.title}`}
                  >
                    <FileText className="w-3 h-3 opacity-60" />
                    <span className="truncate max-w-[200px]">{link.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Outlinks */}
          {linksPayload.outlinks.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <ArrowUpRight className="w-3 h-3 text-slate-400" />
                <span>Outgoing Links ({linksPayload.outlinks.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {linksPayload.outlinks.map((link) => (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => handleNavigateToItem(link.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-white/[0.08] text-xs font-medium transition-all cursor-pointer shadow-2xs active:scale-95"
                    title={`Links to ${link.title}`}
                  >
                    <Link2 className="w-3 h-3 opacity-60 text-slate-500" />
                    <span className="truncate max-w-[200px]">{link.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
