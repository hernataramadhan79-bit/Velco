import React, { useState } from 'react';
import { Item, CreateItemInput } from '../../types/item';
import { ItemCard } from '../../components/items/ItemCard';
import { FileText, Plus } from 'lucide-react';

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
          className="w-full py-3.5 px-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-400 dark:hover:border-slate-700 bg-white/50 dark:bg-slate-900/50 flex items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Write a new note...</span>
        </button>
      ) : (
        <form
          onSubmit={handleCreate}
          className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            className="w-full text-base font-bold bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
            autoFocus
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note in Markdown..."
            rows={4}
            className="w-full text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
          />
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
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
            <div className="text-center py-16 text-xs text-slate-400">
              No notes saved yet.
            </div>
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
