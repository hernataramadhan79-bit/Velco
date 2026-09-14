import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Sparkles, Download, X, Loader2, RefreshCw } from 'lucide-react';

interface UpdateInfo {
  should_update: boolean;
  current_version: string;
  version: string;
  body?: string | null;
  date?: string | null;
}

export const UpdateBanner: React.FC = () => {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function checkForUpdates() {
      try {
        const info = await invoke<UpdateInfo | null>('check_for_updates');
        if (isMounted && info && info.should_update) {
          setUpdate(info);
        }
      } catch (err) {
        // Silently catch offline or unconfigured endpoint in dev
        console.debug('Updater check info:', err);
      }
    }

    // Delay check slightly so app startup isn't contested
    const timer = setTimeout(checkForUpdates, 3000);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  if (!update || dismissed) return null;

  const handleInstall = async () => {
    try {
      setIsUpdating(true);
      setError(null);
      await invoke('install_update');
    } catch (err: any) {
      setIsUpdating(false);
      setError(typeof err === 'string' ? err : err?.message || 'Failed to install update');
    }
  };

  return (
    <div className="w-full bg-gradient-to-r from-blue-600/15 via-indigo-600/10 to-blue-600/15 border-b border-blue-500/20 px-4 py-2 flex items-center justify-between gap-3 text-xs z-30 transition-all">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="p-1 rounded-md bg-blue-500/20 text-blue-500 dark:text-blue-400 shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
        </span>
        <div className="flex items-center gap-2 truncate">
          <span className="font-medium text-slate-800 dark:text-zinc-200 truncate">
            Velco v{update.version} is available!
          </span>
          <span className="hidden sm:inline text-slate-500 dark:text-zinc-400">
            (Current: v{update.current_version})
          </span>
          {error && <span className="text-rose-500 truncate ml-2 font-mono text-[11px]">{error}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleInstall}
          disabled={isUpdating}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium shadow-xs transition-colors cursor-pointer text-[11px]"
        >
          {isUpdating ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Updating...</span>
            </>
          ) : (
            <>
              <Download className="w-3 h-3" />
              <span>Update & Restart</span>
            </>
          )}
        </button>

        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 rounded hover:bg-slate-200/50 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
          title="Dismiss update banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
