import React, { useState } from 'react';
import { Tag, Item } from '../../types/item';
import { ItemCard } from '../../components/items/ItemCard';
import { Tag as TagIcon, Plus, Trash2 } from 'lucide-react';
import { EmptyState } from '../../components/common/EmptyState';

interface TagsViewProps {
  tags: Tag[];
  items: Item[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  onAddTag: (name: string, color?: string) => Promise<Tag>;
  onRemoveTag: (tagId: string) => Promise<void>;
  onSelect: (item: Item) => void;
  onToggleTask: (itemId: string, completed: boolean) => void;
  onToggleFavorite: (itemId: string) => void;
  onTrash: (itemId: string) => void;
}

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#ef4444', // red
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
];

export const TagsView: React.FC<TagsViewProps> = ({
  tags,
  items,
  selectedTagId,
  onSelectTag,
  onAddTag,
  onRemoveTag,
  onSelect,
  onToggleTask,
  onToggleFavorite,
  onTrash,
}) => {
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    await onAddTag(newTagName.trim(), selectedColor);
    setNewTagName('');
  };

  const selectedTag = tags.find((t) => t.id === selectedTagId);
  const filteredItems = selectedTagId
    ? items.filter((i) => i.tags && i.tags.some((t) => t.id === selectedTagId))
    : items;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Create Tag Bar */}
      <form
        onSubmit={handleCreate}
        className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center gap-3 text-xs"
      >
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <TagIcon className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Create a new tag..."
            className="flex-1 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        {/* Color picker pills */}
        <div className="flex items-center gap-1.5">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedColor(c)}
              className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                selectedColor === c ? 'scale-125 ring-2 ring-blue-500/50' : ''
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={!newTagName.trim()}
          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Tag</span>
        </button>
      </form>

      {/* Tags Pills Cloud */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSelectTag(null)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            selectedTagId === null
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          All Tags ({tags.length})
        </button>

        {tags.map((tag) => {
          const isSelected = selectedTagId === tag.id;
          const count = items.filter(
            (i) => i.tags && i.tags.some((t) => t.id === tag.id)
          ).length;

          return (
            <div
              key={tag.id}
              className={`inline-flex items-center rounded-xl text-xs transition-all border ${
                isSelected
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <button
                onClick={() => onSelectTag(isSelected ? null : tag.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 font-medium cursor-pointer"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span>{tag.name}</span>
                <span className="opacity-60 text-[10px] font-mono">({count})</span>
              </button>
              <button
                onClick={() => onRemoveTag(tag.id)}
                className="pr-2 text-slate-400 hover:text-red-500 transition-colors"
                title="Delete tag"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Filtered Items */}
      <div className="space-y-3 pt-2">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          {selectedTag ? `Items tagged "${selectedTag.name}"` : 'All Tagged Items'}{' '}
          ({filteredItems.length})
        </div>

        <div className="space-y-2.5">
          {filteredItems.length === 0 ? (
            <EmptyState
              icon={TagIcon}
              title={selectedTag ? `No items tagged "${selectedTag.name}"` : 'No tagged items'}
              description="Assign tags to tasks, notes, links, or files from their detail inspector or quick capture to organize your knowledge."
              badge="🏷️"
            />
          ) : (
            filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onSelect={onSelect}
                onToggleTask={onToggleTask}
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
