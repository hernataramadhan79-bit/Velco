import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  DownloadCloud,
  ShieldCheck,
  Cpu,
  Database,
  Layers,
  ExternalLink,
} from 'lucide-react';
import { openExternalUrl } from '../../../utils/urlUtils';

interface UpdateInfo {
  should_update: boolean;
  current_version: string;
  version: string;
  body?: string | null;
  date?: string | null;
}

interface ProgressPayload {
  chunk_length: number;
  content_length: number | null;
}

export const AboutSection: React.FC = () => {
  const [currentVersion, setCurrentVersion] = useState<string>('0.2.6');
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ downloaded: number; total: number | null } | null>(null);

  useEffect(() => {
    let isMounted = true;
    invoke<string>('get_app_version')
      .then((ver) => {
        if (isMounted && ver) {
          setCurrentVersion(ver);
        }
      })
      .catch((err) => {
        console.debug('Failed to get app version:', err);
      });

    let unlisten: (() => void) | undefined;
    listen<ProgressPayload>('velco://updater-progress', (event) => {
      if (!isMounted) return;
      setDownloadProgress((prev) => {
        const prevDownloaded = prev?.downloaded ?? 0;
        const downloaded = prevDownloaded + event.payload.chunk_length;
        const total = event.payload.content_length ?? prev?.total ?? null;
        return { downloaded, total };
      });
    }).then((fn) => {
      unlisten = fn;
    }).catch(() => {});

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, []);

  const handleCheckUpdate = async () => {
    setChecking(true);
    setError(null);
    setChecked(false);
    setDownloadProgress(null);
    try {
      const res = await invoke<UpdateInfo | null>('check_for_updates');
      if (res) {
        if (res.current_version) {
          setCurrentVersion(res.current_version);
        }
        if (res.should_update) {
          setUpdateInfo(res);
        } else {
          setUpdateInfo(null);
          setChecked(true);
        }
      } else {
        setUpdateInfo(null);
        setChecked(true);
      }
    } catch (err: any) {
      console.warn('Update check failed:', err);
      setError(err?.message || String(err));
    } finally {
      setChecking(false);
    }
  };

  const handleInstallUpdate = async () => {
    setInstalling(true);
    setError(null);
    try {
      await invoke('install_update');
    } catch (err: any) {
      console.error('Update install failed:', err);
      setError(err?.message || String(err));
      setInstalling(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-100">
      {/* App Info Card */}
      <div className="bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] p-5 shadow-2xs flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-slate-900 dark:text-zinc-100">
            Velco Desktop
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400">
            Local-First Context-Bound AI Workstation
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 font-mono text-xs font-semibold border border-slate-200 dark:border-white/[0.08]">
          v{currentVersion}
        </span>
      </div>

      {/* Software Updates */}
      <div className="bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-zinc-200 flex items-center gap-2">
            <DownloadCloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Software Updates</span>
          </div>
          <button
            type="button"
            onClick={handleCheckUpdate}
            disabled={checking || installing}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking...' : 'Check for Updates'}</span>
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800/40 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold">Update check failed</div>
              <div className="text-[11px] opacity-90">{error}</div>
              <div className="mt-2">
                <a
                  href="https://github.com/hernataramadhan79-bit/Velco/releases/latest"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    void openExternalUrl('https://github.com/hernataramadhan79-bit/Velco/releases/latest');
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 hover:underline font-medium cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Download update directly from GitHub Releases</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {checked && !updateInfo && !error && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>You are on the latest version (v{currentVersion}).</span>
            </div>
            <a
              href="https://github.com/hernataramadhan79-bit/Velco/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                void openExternalUrl('https://github.com/hernataramadhan79-bit/Velco/releases/latest');
              }}
              className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300 hover:underline font-medium cursor-pointer"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Release Notes</span>
            </a>
          </div>
        )}

        {updateInfo && (
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-blue-900 dark:text-blue-100">
                  New Version Available: v{updateInfo.version}
                </span>
                <div className="text-[11px] text-blue-700 dark:text-blue-300">
                  Current: v{updateInfo.current_version || currentVersion}
                </div>
              </div>
              <button
                type="button"
                onClick={handleInstallUpdate}
                disabled={installing}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {installing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Update Now</span>
                )}
              </button>
            </div>

            {/* Live Progress Bar during Update */}
            {installing && downloadProgress && downloadProgress.total && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px] font-mono text-blue-800 dark:text-blue-200">
                  <span>Downloading package...</span>
                  <span>{Math.min(100, Math.round((downloadProgress.downloaded / downloadProgress.total) * 100))}%</span>
                </div>
                <div className="w-full bg-blue-200/60 dark:bg-blue-900/40 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-150 rounded-full"
                    style={{
                      width: `${Math.min(100, Math.round((downloadProgress.downloaded / downloadProgress.total) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {updateInfo.body && (
              <div className="text-[11px] text-slate-600 dark:text-zinc-300 bg-white dark:bg-[#101014] p-2.5 rounded border border-blue-100 dark:border-white/[0.06] whitespace-pre-wrap max-h-32 overflow-y-auto font-sans">
                {updateInfo.body}
              </div>
            )}

            <div className="pt-1 flex items-center justify-end">
              <a
                href="https://github.com/hernataramadhan79-bit/Velco/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  void openExternalUrl('https://github.com/hernataramadhan79-bit/Velco/releases/latest');
                }}
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Manual download installer from GitHub</span>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* System Architecture */}
      <div className="bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] p-5 shadow-2xs space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
          Architecture &amp; Core Guarantees
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.07] space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-zinc-200">
              <Database className="w-3.5 h-3.5 text-blue-500" />
              <span>Local SQLite + FTS5</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Zero cloud sync requirements. Full-text search queries execute offline in milliseconds.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.07] space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-zinc-200">
              <Cpu className="w-3.5 h-3.5 text-emerald-500" />
              <span>Rust Native Kernel</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Memory safe, high throughput parsing, token counting, and thread pool orchestration.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.07] space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-zinc-200">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
              <span>Zero Telemetry</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              No tracking scripts, analytics, or behavioral cookies. Your work stays private.
            </p>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] p-5 shadow-2xs space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
          Keyboard Shortcuts
        </div>
        <div className="divide-y divide-slate-100 dark:divide-white/[0.06] text-xs">
          {[
            { key: 'Ctrl + B', label: 'Toggle Sidebar' },
            { key: 'Ctrl + K', label: 'Global Search' },
            { key: 'Ctrl + J', label: 'Toggle The Foundry' },
            { key: 'Ctrl + Enter', label: 'Save capture' },
            { key: '?', label: 'Open Keyboard Shortcuts Sheet' },
            { key: 'Escape', label: 'Close modals / return to workspace' },
          ].map((s, idx) => (
            <div key={idx} className="py-2.5 flex items-center justify-between">
              <span className="text-slate-600 dark:text-zinc-400">{s.label}</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.05] font-mono text-[10px] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.08]">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
