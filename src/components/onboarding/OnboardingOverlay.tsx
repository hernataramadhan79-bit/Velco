import React from 'react';
import { useSettings } from '../../stores/settingsStore';
import {
  HardDrive,
  Cpu,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface OnboardingOverlayProps {
  onDismiss?: () => void;
}

export const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ onDismiss }) => {
  const { settings, updateSettings } = useSettings();

  if (settings.onboardingCompleted) return null;

  const handleComplete = () => {
    updateSettings({ onboardingCompleted: true });
    if (onDismiss) onDismiss();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-[#141418] rounded-2xl border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden flex flex-col">
        {/* Hero Section */}
        <div className="p-6 sm:p-8 bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-950/20 dark:to-transparent border-b border-slate-100 dark:border-white/[0.06] text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 mb-3">
            <Zap className="w-6 h-6 fill-current" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
            Welcome to Velco Desktop
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
            Your local-first, context-bound AI Workspace. Built for privacy, speed, and deep intellectual focus.
          </p>
        </div>

        {/* 3 Pillars */}
        <div className="p-6 sm:p-8 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Pillar 1: Local-First Storage */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200/80 dark:border-white/[0.06] space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <HardDrive className="w-4 h-4" />
              </div>
              <div className="font-semibold text-xs text-slate-900 dark:text-zinc-100">
                100% Local-First
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                All data, attachments, and FTS5 search indices reside entirely on your filesystem. Zero lock-in.
              </p>
            </div>

            {/* Pillar 2: Context Workbench */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200/80 dark:border-white/[0.06] space-y-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div className="font-semibold text-xs text-slate-900 dark:text-zinc-100">
                Workbench
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                Stage relevant notes and files into Workbench to execute executive summaries and task extraction without hallucinations.
              </p>
            </div>

            {/* Pillar 3: Air-Gapped AI */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200/80 dark:border-white/[0.06] space-y-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="font-semibold text-xs text-slate-900 dark:text-zinc-100">
                Private Intelligence
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                Connect Ollama or LM Studio for offline intelligence. Cloud providers require explicit opt-in and track token expenses.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Footer */}
        <div className="p-5 sm:p-6 bg-slate-50 dark:bg-[#101014] border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
            Press <kbd className="font-semibold text-slate-600 dark:text-zinc-300">?</kbd> anytime for keyboard shortcuts
          </div>
          <button
            type="button"
            onClick={handleComplete}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <span>Get Started</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
