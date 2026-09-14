import React from 'react';
import { useSettings } from '../../../stores/settingsStore';
import { PriorityLevel } from '../../../types/item';
import { Sun, Moon, Laptop, Check } from 'lucide-react';

export const AppearanceSection: React.FC = () => {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="space-y-6 animate-in fade-in duration-100">
      <div className="bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] p-5 shadow-2xs space-y-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
            Theme Mode
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            Choose between native Dark Mode, clean Light Mode, or automatic System synchronization.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            { id: 'system', label: 'System Sync', icon: Laptop },
            { id: 'light', label: 'Light Mode', icon: Sun },
            { id: 'dark', label: 'Dark Mode', icon: Moon },
          ].map((t) => {
            const Icon = t.icon;
            const isSelected = settings.theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => updateSettings({ theme: t.id as any })}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'border-blue-600 dark:border-blue-500 bg-blue-50/60 dark:bg-blue-950/25 text-blue-950 dark:text-blue-100 ring-1 ring-blue-500/30 shadow-2xs'
                    : 'border-slate-200 dark:border-white/[0.07] bg-slate-50 dark:bg-[#101014] text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-white/[0.14]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-zinc-500'}`} />
                  <span className="text-xs font-medium">{t.label}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] p-5 shadow-2xs space-y-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
            Default Task Priority
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            Newly created tasks without explicit priority tags will inherit this level.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['low', 'medium', 'high', 'urgent'] as PriorityLevel[]).map((p) => {
            const isSelected = settings.defaultTaskPriority === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => updateSettings({ defaultTaskPriority: p })}
                className={`px-3 py-1.5 rounded-lg text-xs capitalize font-medium border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-950 border-transparent shadow-2xs'
                    : 'bg-slate-50 dark:bg-[#101014] border-slate-200 dark:border-white/[0.07] text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/[0.14]'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
