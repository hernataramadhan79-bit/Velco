import React, { useState, useEffect, useCallback } from 'react';
import { aiService } from '../../../services/ai';
import { AiUsageSummary } from '../../../types/ai';
import { Coins, Activity, RefreshCw, AlertCircle } from 'lucide-react';

export const AiUsageDashboard: React.FC = () => {
  const [summary, setSummary] = useState<AiUsageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await aiService.getUsageSummary();
      setSummary(data);
    } catch (err: any) {
      console.warn('Failed to load AI usage summary:', err);
      setError(err?.message || 'Failed to query AI usage telemetry');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1_000_000) {
      return `${(tokens / 1_000_000).toFixed(2)}M`;
    }
    if (tokens >= 1_000) {
      return `${(tokens / 1_000).toFixed(1)}k`;
    }
    return tokens.toString();
  };

  const formatCost = (cost: number): string => {
    if (cost <= 0) return '$0.00';
    if (cost < 0.01) return `<$0.01`;
    return `$${cost.toFixed(3)}`;
  };

  return (
    <div className="bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
            AI Usage & Cost Guardrails
          </span>
        </div>
        <button
          type="button"
          onClick={fetchUsage}
          disabled={loading}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <p className="text-xs text-slate-500 dark:text-zinc-400">
        Estimated token throughput and API expense tracked locally in SQLite. Local inference (Ollama, LM Studio) is always free.
      </p>

      {error ? (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Today Card */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.07] space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Today
            </div>
            <div className="text-base font-mono font-bold text-slate-900 dark:text-zinc-100">
              {summary ? formatCost(summary.today_cost) : '$0.00'}
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 flex items-center gap-1">
              <Activity className="w-3 h-3 text-slate-400" />
              <span>
                {summary
                  ? `${formatTokens(summary.today_tokens_in + summary.today_tokens_out)} tokens`
                  : '0 tokens'}
              </span>
            </div>
          </div>

          {/* Month to Date Card */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.07] space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              This Month
            </div>
            <div className="text-base font-mono font-bold text-slate-900 dark:text-zinc-100">
              {summary ? formatCost(summary.month_cost) : '$0.00'}
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 flex items-center gap-1">
              <Activity className="w-3 h-3 text-slate-400" />
              <span>
                {summary
                  ? `${formatTokens(summary.month_tokens_in + summary.month_tokens_out)} tokens`
                  : '0 tokens'}
              </span>
            </div>
          </div>

          {/* All Time Card */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.07] space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              All-Time Cost
            </div>
            <div className="text-base font-mono font-bold text-slate-900 dark:text-zinc-100">
              {summary ? formatCost(summary.total_cost) : '$0.00'}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              SQLite tracked
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
