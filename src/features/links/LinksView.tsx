import React, { useState } from 'react';
import { Item, CreateItemInput } from '../../types/item';
import { ItemCard } from '../../components/items/ItemCard';
import { Link2, Plus } from 'lucide-react';

interface LinksViewProps {
  links: Item[];
  onCapture: (input: CreateItemInput) => Promise<any>;
  onSelect: (item: Item) => void;
  onToggleFavorite: (itemId: string) => void;
  onTrash: (itemId: string) => void;
}

export const LinksView: React.FC<LinksViewProps> = ({
  links,
  onCapture,
  onSelect,
  onToggleFavorite,
  onTrash,
}) => {
  const [url, setUrl] = useState('');

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    const formatted = url.startsWith('http') ? url.trim() : `https://${url.trim()}`;
    let domain = '';
    try {
      const u = new URL(formatted);
      domain = u.hostname.replace(/^www\./, '');
    } catch {
      domain = formatted;
    }

    await onCapture({
      type: 'link',
      title: domain,
      link: {
        url: formatted,
        domain,
        pageTitle: domain,
      },
    });

    setUrl('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Quick Link Input */}
      <form
        onSubmit={handleAddLink}
        className="p-2.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-2"
      >
        <Link2 className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a URL (e.g. https://github.com)..."
          className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!url.trim()}
          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Save Link</span>
        </button>
      </form>

      {/* Links Stream */}
      <div className="space-y-3">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          Saved Bookmarks & Links ({links.length})
        </div>
        <div className="space-y-2.5">
          {links.length === 0 ? (
            <div className="text-center py-16 text-xs text-slate-400">
              No links saved yet.
            </div>
          ) : (
            links.map((item) => (
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
