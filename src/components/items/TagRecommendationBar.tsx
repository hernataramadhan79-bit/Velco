import React, { useState } from 'react';
import { Sparkles, Check, Plus, X, Tag as TagIcon } from 'lucide-react';
import { TagRecommendation } from '../../services/ai/taskExtractor';

interface TagRecommendationBarProps {
  recommendations: TagRecommendation[];
  onApply: (selectedTags: TagRecommendation[]) => Promise<void>;
  onDismiss: () => void;
  isLoading?: boolean;
}

export const TagRecommendationBar: React.FC<TagRecommendationBarProps> = ({
  recommendations: initialTags,
  onApply,
  onDismiss,
  isLoading = false,
}) => {
  const [tags, setTags] = useState<TagRecommendation[]>(initialTags);
  const [isApplying, setIsApplying] = useState(false);

  const selectedCount = tags.filter((t) => t.selected).length;

  const toggleTag = (name: string) => {
    setTags((prev) =>
      prev.map((t) => (t.name === name ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleApply = async () => {
    const chosen = tags.filter((t) => t.selected);
    if (chosen.length === 0) return;

    setIsApplying(true);
    try {
      await onApply(chosen);
    } finally {
      setIsApplying(false);
    }
  };

  if (tags.length === 0) return null;

  return (
    <div className="p-3 rounded-xl bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.07] space-y-2.5 view-enter select-none shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
            <Sparkles className="w-3 h-3" />
          </div>
          <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-slate-800 dark:text-zinc-200">
            Suggested Tags
          </span>
          <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 hidden sm:inline">
            [AI Recommendations]
          </span>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
          title="Dismiss suggestions"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Interactive Tag Pills */}
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {tags.map((tag) => (
          <button
            key={tag.name}
            type="button"
            onClick={() => toggleTag(tag.name)}
            title={tag.reason ? `${tag.reason} (${tag.category})` : tag.category}
            className={`px-2 py-0.8 rounded-md text-xs font-mono flex items-center gap-1.5 border transition-all cursor-pointer ${
              tag.selected
                ? 'bg-blue-600 text-white border-blue-500 shadow-2xs'
                : 'bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.12]'
            }`}
          >
            {tag.selected ? (
              <Check className="w-3 h-3" />
            ) : (
              <Plus className="w-3 h-3 opacity-60" />
            )}
            <span>{tag.name}</span>
            {tag.isExisting && (
              <span
                className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                  tag.selected
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200/80 dark:bg-white/[0.08] text-slate-600 dark:text-zinc-400'
                }`}
              >
                existing
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/[0.06] text-xs">
        <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
          {selectedCount} selected
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="px-2.5 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={selectedCount === 0 || isApplying || isLoading}
            className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-mono text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
          >
            <span>{isApplying ? 'Applying...' : `Apply (${selectedCount})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
