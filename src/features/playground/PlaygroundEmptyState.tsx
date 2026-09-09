import React from 'react';
import { Sparkles, ShieldAlert, Zap } from 'lucide-react';
import { useSettings } from '../../stores/settingsStore';

interface PlaygroundEmptyStateProps {
  onSelectPrompt: (promptText: string) => void;
  disabled?: boolean;
}

const STARTER_PROMPTS = [
  'What are my highest priority tasks and approaching deadlines?',
  'Draft an executive synthesis of my recent workstation notes.',
  'Analyze my active context items and brainstorm concrete next steps.',
  'Identify potential gaps, contradictions, or blockers in my items.',
];

export const PlaygroundEmptyState: React.FC<PlaygroundEmptyStateProps> = ({
  onSelectPrompt,
  disabled = false,
}) => {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-12 sm:py-20 flex flex-col items-center text-center animate-in fade-in duration-200 select-none">
      {/* Minimal Icon */}
      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-zinc-300 flex items-center justify-center mb-4">
        <Sparkles className="w-5 h-5 text-blue-500" />
      </div>

      {/* Greeting Heading */}
      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
        How can I help you today?
      </h2>
      <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1 max-w-md">
        Ask questions, synthesize notes, or attach workstation items for local context reasoning.
      </p>

      {/* AI Disabled Alert (Only visible if AI is turned off) */}
      {!settings.aiEnabled && (
        <div className="w-full mt-6 p-3.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 flex items-center justify-between gap-3 text-left">
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

      {/* Minimal Prompt Suggestions */}
      <div className="w-full mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
        {STARTER_PROMPTS.map((promptText, idx) => (
          <button
            key={idx}
            onClick={() => onSelectPrompt(promptText)}
            disabled={disabled || !settings.aiEnabled}
            className="p-3 rounded-xl bg-white dark:bg-[#121216] hover:bg-slate-50 dark:hover:bg-[#17171d] border border-slate-200 dark:border-white/[0.07] hover:border-slate-300 dark:hover:border-white/[0.14] text-xs text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shadow-2xs leading-relaxed disabled:opacity-40 disabled:pointer-events-none"
          >
            {promptText}
          </button>
        ))}
      </div>
    </div>
  );
};
