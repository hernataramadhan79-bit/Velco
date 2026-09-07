import React, { useState } from 'react';
import { Item, CreateItemInput } from '../../types/item';
import { ItemCard } from '../../components/items/ItemCard';
import { Plus, FileText } from 'lucide-react';
import { EmptyState } from '../../components/common/EmptyState';

interface NotesViewProps {
  notes: Item[];
  onCapture: (input: CreateItemInput) => Promise<any>;
  onSelect: (item: Item) => void;
  onToggleFavorite: (itemId: string) => void;
  onTrash: (itemId: string) => void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  notes,
  onCapture,
  onSelect,
  onToggleFavorite,
  onTrash,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !content.trim()) return;

    await onCapture({
      type: 'note',
      title: title.trim() || 'Untitled Note',
      content: content.trim(),
    });

    setTitle('');
    setContent('');
    setIsCreating(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Add Note Button / Form */}
      {!isCreating ? (
        <button
          onClick={() => setIsCreating(true)}
          className="w-full py-3.5 px-4 rounded-xl border border-dashed border-slate-300 dark:border-white/[0.12] text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:border-slate-400 dark:hover:border-white/[0.2] bg-white/60 dark:bg-[#141418]/60 flex items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Write a new note...</span>
        </button>
      ) : (
        <form
          onSubmit={handleCreate}
          className="p-4 bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] shadow-2xs space-y-3"
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            className="w-full text-base font-bold bg-transparent text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none"
            autoFocus
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note in Markdown..."
            rows={4}
            className="w-full text-xs font-mono bg-transparent text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
          />
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold cursor-pointer shadow-2xs"
            >
              Save Note
            </button>
          </div>
        </form>
      )}

      {/* Notes Stream */}
      <div className="space-y-3">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          All Notes ({notes.length})
        </div>
        <div className="space-y-2.5">
          {notes.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No notes written yet"
              description="Capture your ideas, meeting specs, markdown docs, or technical insights locally."
              action={
                !isCreating
                  ? {
                      label: 'Write a Note',
                      onClick: () => setIsCreating(true),
                      icon: Plus,
                    }
                  : undefined
              }
              badgeIcon={FileText}
            />
          ) : (
            notes.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onSelect={onSelect}
                onToggleFavorite={onToggleFavorite}
                onTrash={onTrash}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
