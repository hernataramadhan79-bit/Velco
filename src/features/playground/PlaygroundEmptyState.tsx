import React from 'react';
import {
  Sparkles,
  ShieldAlert,
  Zap,
  CheckSquare,
  FileText,
  Lightbulb,
  Search,
  ArrowUpRight,
} from 'lucide-react';
import { useSettings } from '../../stores/settingsStore';

interface PlaygroundEmptyStateProps {
  onSelectPrompt: (promptText: string) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

interface StarterPromptConfig {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  description: string;
  prompt: string;
}

const STARTER_PROMPTS: StarterPromptConfig[] = [
  {
    icon: CheckSquare,
    iconClass: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200/80 dark:border-blue-500/20',
    title: 'Prioritize Tasks',
    description: 'Review active tasks & approaching due dates',
    prompt: 'What are my highest priority tasks and approaching deadlines based on items in Velco? Outline a sequential execution plan.',
  },
  {
    icon: FileText,
    iconClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/80 dark:border-emerald-500/20',
    title: 'Synthesize Notes',
    description: 'Draft an executive overview of recent workstation notes',
    prompt: 'Please draft an executive synthesis of my recent notes, updates, and research stored in the workstation.',
  },
  {
    icon: Lightbulb,
    iconClass: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200/80 dark:border-amber-500/20',
    title: 'Brainstorm Next Steps',
    description: 'Analyze active items & propose architectural actions',
    prompt: 'Analyze my active context items and brainstorm 3-5 concrete architectural or procedural next steps.',
  },
  {
    icon: Search,
    iconClass: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border-purple-200/80 dark:border-purple-500/20',
    title: 'Analyze Blockers',
    description: 'Detect contradictions, missing context & dependencies',
    prompt: 'Based on available workstation context, identify potential contradictions, gaps, or dependencies that require resolution.',
  },
];

export const PlaygroundEmptyState: React.FC<PlaygroundEmptyStateProps> = ({
  onSelectPrompt,
  disabled = false,
  children,
}) => {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 sm:py-10 flex flex-col items-center text-center animate-in fade-in duration-200 select-none space-y-5">
      {/* 1. Minimal Glowing Emblem & Heading */}
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-b from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 border border-blue-500/20 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 shadow-sm shadow-blue-500/5">
          <Sparkles className="w-4 h-4 stroke-[2]" />
        </div>

        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
          How can I help you today?
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1 max-w-md leading-normal">
          Ask questions, synthesize notes, or attach workstation items for local context reasoning.
        </p>
      </div>

      {/* 2. AI Disabled Alert (if turned off in Settings) */}
      {!settings.aiEnabled && (
        <div className="w-full p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 flex items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-400">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>AI features are turned off in Settings.</span>
          </div>
          <button
            type="button"
            onClick={() => updateSettings({ aiEnabled: true })}
            className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1"
          >
            <Zap className="w-3 h-3 fill-current" />
            <span>Enable</span>
          </button>
        </div>
      )}

      {/* 3. Centered Input Dock Slot */}
      {children && (
        <div className="w-full">
          {children}
        </div>
      )}

      {/* 4. Symmetrical 2x2 Starter Prompt Cards */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
        {STARTER_PROMPTS.map((card, idx) => {
          const Icon = card.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPrompt(card.prompt)}
              disabled={disabled || !settings.aiEnabled}
              className="group p-3 sm:p-3.5 rounded-xl bg-white/70 dark:bg-[#121216]/80 hover:bg-slate-50 dark:hover:bg-[#17171d] border border-slate-200/80 dark:border-white/[0.07] hover:border-slate-300 dark:hover:border-white/[0.14] transition-all cursor-pointer shadow-2xs hover:shadow-xs flex items-center gap-3 disabled:opacity-40 disabled:pointer-events-none text-left"
            >
              <div className={`p-2 rounded-lg border shrink-0 ${card.iconClass}`}>
                <Icon className="w-3.5 h-3.5 stroke-[1.75]" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                    {card.title}
                  </span>
                  <ArrowUpRight className="w-3 h-3 text-slate-300 dark:text-zinc-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                </div>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate mt-0.5 leading-snug text-left">
                  {card.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
