import React, { useState, useMemo } from 'react';
import { AIModelInfo } from '../../types/ai';
import {
  Sparkles,
  RefreshCw,
  Check,
  Search,
  ChevronDown,
  ChevronUp,
  Cpu,
  Edit3,
} from 'lucide-react';

interface DynamicModelSelectorProps {
  providerLabel: string;
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  models: AIModelInfo[];
  isLoading: boolean;
  onRefresh: () => void;
  hasApiKeyOrUrl: boolean;
  apiKeyHelpText?: string;
}

function formatContextLength(ctx?: number): string | null {
  if (!ctx || ctx <= 0) return null;
  if (ctx >= 1000000) {
    const m = (ctx / 1000000).toFixed(ctx % 1000000 === 0 ? 0 : 1);
    return `${m}M ctx`;
  }
  if (ctx >= 1000) {
    return `${Math.round(ctx / 1000)}k ctx`;
  }
  return `${ctx} ctx`;
}

export const DynamicModelSelector: React.FC<DynamicModelSelectorProps> = ({
  providerLabel,
  selectedModel,
  onSelectModel,
  models,
  isLoading,
  onRefresh,
  hasApiKeyOrUrl,
  apiKeyHelpText,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customModelText, setCustomModelText] = useState('');

  // Find info of the currently selected model if available
  const activeModelInfo = useMemo(() => {
    return models.find((m) => m.id === selectedModel);
  }, [models, selectedModel]);

  // Quick picks: Top 3-4 models for instant 1-click access
  const quickPicks = useMemo(() => {
    if (!models || models.length === 0) return [];
    return models.slice(0, 4);
  }, [models]);

  // Filtered models for catalog browsing
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return models;
    const q = searchQuery.toLowerCase().trim();
    return models.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q))
    );
  }, [models, searchQuery]);

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customModelText.trim()) {
      onSelectModel(customModelText.trim());
      setShowCustomInput(false);
    }
  };

  return (
    <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] space-y-3">
      {/* 1. Header Bar: Title, Count, Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
            Model Selection
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-white/[0.08] text-slate-600 dark:text-zinc-400">
            {models.length > 0 ? `${models.length} available` : 'Curated'}
          </span>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          title="Fetch live models from provider"
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="text-[11px] font-medium">{isLoading ? 'Syncing...' : 'Sync Models'}</span>
        </button>
      </div>

      {/* 2. Active Selected Model Card */}
      <div className="p-2.5 rounded-lg bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.07] flex items-center justify-between gap-3 shadow-2xs">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1">
              <Cpu className="w-3 h-3 text-blue-500" />
              Active
            </span>
            <span className="font-mono text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
              {selectedModel || 'None selected'}
            </span>
            {activeModelInfo?.contextLength && formatContextLength(activeModelInfo.contextLength) && (
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                {formatContextLength(activeModelInfo.contextLength)}
              </span>
            )}
            {activeModelInfo?.isFree && (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                FREE TIER
              </span>
            )}
          </div>
          {activeModelInfo?.description && (
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 line-clamp-1">
              {activeModelInfo.description}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowCustomInput(!showCustomInput)}
          title="Enter custom model ID"
          className="text-[11px] text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer shrink-0"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3. Custom Model ID Input (if open) */}
      {showCustomInput && (
        <form onSubmit={handleApplyCustom} className="flex gap-2 items-center pt-1 animate-in fade-in duration-150">
          <input
            type="text"
            value={customModelText}
            onChange={(e) => setCustomModelText(e.target.value)}
            placeholder={`Enter custom model ID (e.g. ${selectedModel || 'model-name'})`}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.1] font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <button
            type="submit"
            disabled={!customModelText.trim()}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => setShowCustomInput(false)}
            className="px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
          >
            Cancel
          </button>
        </form>
      )}

      {/* 4. Quick-Pick Model Chips */}
      {quickPicks.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Recommended &amp; Primary
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickPicks.map((m) => {
              const isSelected = selectedModel === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectModel(m.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold shadow-2xs ring-1 ring-blue-500/20'
                      : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141418] text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-white/[0.15]'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />}
                  <span className="truncate max-w-[200px]">{m.name || m.id}</span>
                  {m.contextLength && formatContextLength(m.contextLength) && (
                    <span className="text-[9px] text-slate-400 dark:text-zinc-500">
                      ({formatContextLength(m.contextLength)})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Collapsible Full Dynamic Catalog */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setIsCatalogOpen(!isCatalogOpen)}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-100/80 dark:bg-white/[0.04] hover:bg-slate-200/60 dark:hover:bg-white/[0.08] text-slate-600 dark:text-zinc-400 text-xs font-medium transition-colors cursor-pointer"
        >
          <span>
            {isCatalogOpen ? 'Hide full catalog' : `Browse all ${models.length} models`}
          </span>
          {isCatalogOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {isCatalogOpen && (
          <div className="mt-2 p-2.5 rounded-lg bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.08] space-y-2 animate-in fade-in duration-150">
            {/* Search filter input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter models by name or id..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Scrollable list */}
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {filteredModels.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 dark:text-zinc-500">
                  No models matching &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                filteredModels.map((m) => {
                  const isSelected = selectedModel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onSelectModel(m.id)}
                      className={`w-full text-left p-2 rounded-md border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'border-blue-600 dark:border-blue-500 bg-blue-50/60 dark:bg-blue-950/30'
                          : 'border-slate-100 dark:border-white/[0.04] bg-slate-50/50 dark:bg-[#101014]/50 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-xs text-slate-900 dark:text-zinc-100 truncate">
                            {m.name || m.id}
                          </span>
                          {m.isFree && (
                            <span className="px-1 py-0.2 rounded text-[8px] font-bold font-mono bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              FREE
                            </span>
                          )}
                          {m.contextLength && formatContextLength(m.contextLength) && (
                            <span className="text-[9px] font-mono text-slate-400 dark:text-zinc-500">
                              {formatContextLength(m.contextLength)}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 truncate">
                          {m.id}
                        </div>
                        {m.description && (
                          <div className="text-[10px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                            {m.description}
                          </div>
                        )}
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* 6. Informative note if key is missing */}
      {!hasApiKeyOrUrl && (
        <div className="text-[11px] text-amber-600 dark:text-amber-400/90 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1.5 rounded-lg border border-amber-200/60 dark:border-amber-900/30">
          {apiKeyHelpText || `Enter your API key above to load live models directly from ${providerLabel}. Showing standard models.`}
        </div>
      )}
    </div>
  );
};
