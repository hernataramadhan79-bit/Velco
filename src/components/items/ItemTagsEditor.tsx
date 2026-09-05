import React, { useState } from 'react';
import { Tag } from '../../types/item';
import { Plus, X } from 'lucide-react';

interface ItemTagsEditorProps {
  itemTags: Tag[];
  allTags: Tag[];
  onAddTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onCreateTag: (name: string) => Promise<Tag>;
}

export const ItemTagsEditor: React.FC<ItemTagsEditorProps> = ({
  itemTags,
  allTags,
  onAddTag,
  onRemoveTag,
  onCreateTag,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const availableTags = allTags.filter(
    (t) => !itemTags.some((it) => it.id === t.id)
  );

  const handleCreate = async () => {
    if (!newTagName.trim()) return;
    const tag = await onCreateTag(newTagName.trim());
    onAddTag(tag.id);
    setNewTagName('');
    setIsOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {itemTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
            <span>{tag.name}</span>
            <button
              type="button"
              onClick={() => onRemoveTag(tag.id)}
              className="text-slate-400 hover:text-red-500 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-400 transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add tag</span>
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-56 p-2 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 space-y-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                }}
                placeholder="New or search tag..."
                className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />

              <div className="max-h-36 overflow-y-auto space-y-1">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      onAddTag(tag.id);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span>{tag.name}</span>
                  </button>
                ))}

                {newTagName.trim() && !availableTags.some(t => t.name.toLowerCase() === newTagName.trim().toLowerCase()) && (
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-left text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-950/40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create "{newTagName.trim()}"</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
