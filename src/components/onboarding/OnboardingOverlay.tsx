import React, { useState, useEffect } from 'react';
import { useSettings } from '../../stores/settingsStore';
import {
  HardDrive,
  Cpu,
  Layers,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Zap,
  CheckCircle2,
  Link2,
  FileText,
} from 'lucide-react';

interface OnboardingOverlayProps {
  onDismiss?: () => void;
}

export const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ onDismiss }) => {
  const { settings, updateSettings } = useSettings();
  const [step, setStep] = useState(1);

  // Esc to skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleComplete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (settings.onboardingCompleted) return null;

  const handleComplete = () => {
    updateSettings({ onboardingCompleted: true });
    if (onDismiss) onDismiss();
  };

  const nextStep = () => {
    if (step < 5) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-[#141418] rounded-2xl border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden flex flex-col transition-all duration-300">
        
        {/* Progress bar */}
        <div className="flex justify-center gap-2 pt-6 pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i <= step ? 'bg-blue-600 dark:bg-blue-500' : 'bg-slate-200 dark:bg-zinc-800'
              }`}
            />
          ))}
        </div>

        {/* Content Area */}
        <div className="p-6 sm:p-8 min-h-[360px] flex flex-col justify-center">
          {step === 1 && (
            <div className="space-y-6 text-center animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
                <Zap className="w-7 h-7 fill-current" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight mb-2">
                  Welcome to Velco
                </h2>
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  Your local-first AI knowledge workspace
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-8">
                <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-[#1c1c20] border border-slate-200 dark:border-white/[0.05] text-xs font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                  🔒 Zero Telemetry
                </span>
                <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-[#1c1c20] border border-slate-200 dark:border-white/[0.05] text-xs font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                  💾 Local SQLite
                </span>
                <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-[#1c1c20] border border-slate-200 dark:border-white/[0.05] text-xs font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                  🤖 AI Workbench
                </span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 text-center animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="w-12 h-12 mx-auto rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight mb-2">
                  Capture Anything, Instantly
                </h2>
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  Press Ctrl+Space (or click the Spotlight icon) from anywhere on your desktop
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-[#101014] rounded-xl border border-slate-200 dark:border-white/[0.06] p-4 space-y-3 text-left shadow-inner">
                <div className="flex items-center gap-3 p-2 bg-white dark:bg-[#1c1c22] rounded-lg border border-slate-100 dark:border-white/[0.05]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-slate-600 dark:text-zinc-300 flex-1 font-mono">todo: Review the quarterly report</span>
                  <span className="text-[10px] uppercase font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">Task</span>
                </div>
                <div className="flex items-center gap-3 p-2 bg-white dark:bg-[#1c1c22] rounded-lg border border-slate-100 dark:border-white/[0.05]">
                  <Link2 className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-slate-600 dark:text-zinc-300 flex-1 font-mono">https://github.com/...</span>
                  <span className="text-[10px] uppercase font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded">Link</span>
                </div>
                <div className="flex items-center gap-3 p-2 bg-white dark:bg-[#1c1c22] rounded-lg border border-slate-100 dark:border-white/[0.05]">
                  <FileText className="w-4 h-4 text-amber-500" />
                  <span className="text-xs text-slate-600 dark:text-zinc-300 flex-1 font-mono">Meeting notes from today...</span>
                  <span className="text-[10px] uppercase font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">Note</span>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="w-12 h-12 mx-auto rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 flex items-center justify-center mb-4">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight mb-2">
                  Two Modes, One Workspace
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.06]">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-zinc-100 mb-2">Personal Workstation</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                    Inbox, Tasks, Notes, Links, Files. Quick capture and full-text search.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.06]">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-zinc-100 mb-2">The Bridge</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                    Project Capsules with Kanban, P2P LAN sync, AI Workbench.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 text-center animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="w-12 h-12 mx-auto rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 flex items-center justify-center mb-4">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight mb-2">
                  Connect Your AI
                </h2>
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  Local LLMs are always free. Cloud APIs require explicit opt-in.
                </p>
              </div>
              <div className="space-y-3 text-left">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.06] flex gap-4 items-center">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
                      Local (Recommended)
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Free</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">Ollama or LM Studio — runs on your machine, completely private</p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.06] flex gap-4 items-center">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
                      Cloud APIs
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 uppercase tracking-wider">Paid</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">OpenAI, Anthropic, Gemini, Groq — powerful but requires API key</p>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                You can skip this and set it up later in Settings → AI
              </p>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 text-center animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight mb-2">
                  You're All Set!
                </h2>
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  Velco is ready. Here are your key shortcuts:
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-left">
                {[
                  { key: 'Ctrl+K', label: 'Global Search' },
                  { key: 'Ctrl+J', label: 'AI Workbench' },
                  { key: 'Ctrl+B', label: 'Toggle Sidebar' },
                  { key: 'Ctrl+Enter', label: 'Save Capture' },
                  { key: 'Ctrl+,', label: 'Settings' },
                  { key: 'Esc', label: 'Close / Dismiss' },
                ].map((s) => (
                  <div key={s.key} className="flex flex-col p-2.5 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.06]">
                    <kbd className="text-[10px] font-mono font-bold text-slate-700 dark:text-zinc-300 bg-white dark:bg-[#1c1c22] border border-slate-200 dark:border-white/[0.1] rounded px-1.5 py-0.5 mb-1.5 w-max shadow-sm">
                      {s.key}
                    </kbd>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-5 sm:p-6 bg-slate-50 dark:bg-[#101014] border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
          <button
            type="button"
            onClick={handleComplete}
            className="text-xs text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors cursor-pointer"
          >
            Skip setup
          </button>
          
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={prevStep}
              disabled={step === 1}
              className={`p-2 rounded-xl border border-slate-200 dark:border-white/[0.06] flex items-center justify-center transition-all ${
                step === 1 
                  ? 'opacity-50 cursor-not-allowed bg-transparent text-slate-400 dark:text-zinc-600' 
                  : 'bg-white dark:bg-[#1c1c20] text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-[#222226] cursor-pointer'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            {step < 5 ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow-md flex items-center gap-2 transition-all cursor-pointer"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                <span>Start Using Velco</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
