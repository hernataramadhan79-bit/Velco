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
    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50/70 via-blue-50/50 to-slate-50/60 dark:from-indigo-950/30 dark:via-blue-950/20 dark:to-slate-900/40 border border-indigo-200/70 dark:border-indigo-800/50 space-y-2.5 view-enter select-none">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-3 h-3" />
          </div>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            AI Tag Recommendations
          </span>
          <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">
            • Select which tags to attach
          </span>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
            className={`px-2.5 py-1 rounded-xl text-xs font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
              tag.selected
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                : 'bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200/90 dark:border-slate-700/80 hover:border-indigo-400'
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
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                existing
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-indigo-100 dark:border-indigo-900/40 text-xs">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {selectedCount} selected
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="px-2.5 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={selectedCount === 0 || isApplying || isLoading}
            className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
          >
            <span>{isApplying ? 'Applying...' : `Apply ${selectedCount} Tags`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
