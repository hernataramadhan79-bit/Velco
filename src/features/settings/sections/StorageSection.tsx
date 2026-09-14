import React from 'react';
import { useSettings } from '../../../stores/settingsStore';
import { HardDrive, Layers, Folder } from 'lucide-react';

export const StorageSection: React.FC = () => {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="space-y-6 animate-in fade-in duration-100">
      <div className="bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
          <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Data Root Directory</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Velco stores all SQLite databases and attachments on your local file system.
        </p>
        <div>
          <label className="text-xs font-medium text-slate-700 dark:text-zinc-300 block mb-1">
            Directory Path
          </label>
          <input
            type="text"
            value={settings.storageDir}
            onChange={(e) => updateSettings({ storageDir: e.target.value })}
            className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
          <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Subdirectory Hierarchy</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.07]">
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 mb-0.5">
              <Folder className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>database/</span>
            </span>
            <span className="text-[11px] text-slate-400 dark:text-zinc-500">SQLite file `velco.db` with FTS5 search index.</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.07]">
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mb-0.5">
              <Folder className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>attachments/</span>
            </span>
            <span className="text-[11px] text-slate-400 dark:text-zinc-500">Imported files, PDFs, and images with SHA-256 hash.</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.07]">
            <span className="font-mono font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5 mb-0.5">
              <Folder className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              <span>thumbnails/</span>
            </span>
            <span className="text-[11px] text-slate-400 dark:text-zinc-500">Cached image thumbnails for fast rendering.</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.07]">
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-0.5">
              <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>cache/ &amp; logs/</span>
            </span>
            <span className="text-[11px] text-slate-400 dark:text-zinc-500">Temporary processing data and diagnostic logs.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
