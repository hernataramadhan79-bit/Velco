import React, { useState } from 'react';
import { useSettings } from '../../../stores/settingsStore';
import { db } from '../../../services/database';
import {
  Download,
  Upload,
  Shield,
  Clock,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';

export const BackupSection: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportBackup = async () => {
    let url: string | null = null;
    setIsExporting(true);
    try {
      const jsonStr = await db.exportBackup();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `velco_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      const now = Date.now();
      updateSettings({ lastBackupTimestamp: now });
      setBackupMessage('Backup exported successfully.');
      setTimeout(() => setBackupMessage(null), 4000);
    } catch (err: any) {
      setBackupMessage(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
      if (url) setTimeout(() => URL.revokeObjectURL(url as string), 5000);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = reader.result as string;
        const count = await db.importBackup(text);
        setBackupMessage(`Imported ${count} items successfully. Refreshing view...`);
        setTimeout(() => window.location.reload(), 1500);
      } catch (err: any) {
        setBackupMessage(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const formatLastBackup = () => {
    if (!settings.lastBackupTimestamp) {
      return 'No backup exported yet';
    }
    const diffMs = Date.now() - settings.lastBackupTimestamp;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago (${new Date(settings.lastBackupTimestamp).toLocaleDateString()})`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-100">
      {backupMessage && (
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>{backupMessage}</span>
        </div>
      )}

      {/* Manual Backup & Restore */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Export Card */}
        <div className="bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] p-5 shadow-2xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
              <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Export Local Backup</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Downloads a complete JSON snapshot containing all items, capsules, tasks, notes, links, tags, and AI synthesis history.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleExportBackup}
              disabled={isExporting}
              className="w-full px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Exporting...' : 'Export JSON Backup'}</span>
            </button>
          </div>
        </div>

        {/* Import Card */}
        <div className="bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] p-5 shadow-2xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
              <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Restore from Backup</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Select a previously exported JSON backup file to restore relational records and re-index search.
            </p>
          </div>
          <div className="pt-2">
            <label className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-800 dark:text-zinc-200 text-xs font-semibold transition-colors cursor-pointer border border-slate-200 dark:border-white/[0.08]">
              <Upload className="w-3.5 h-3.5" />
              <span>Select Backup File (.json)</span>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportBackup}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Backup Safety Net & Reminders */}
      <div className="bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
            <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Backup Safety Net</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatLastBackup()}</span>
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Set proactive reminders so you never risk losing your local notes, attachments, or knowledge graph.
        </p>

        <div>
          <label className="text-xs font-medium text-slate-700 dark:text-zinc-300 block mb-1.5">
            Backup Reminder Frequency
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { days: 3, label: '3 Days' },
              { days: 7, label: '7 Days' },
              { days: 14, label: '14 Days' },
              { days: 30, label: '30 Days' },
              { days: 0, label: 'Never' },
            ].map((opt) => {
              const currentVal = settings.backupReminderDays ?? 7;
              const isSelected = currentVal === opt.days;
              return (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => updateSettings({ backupReminderDays: opt.days })}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-600 dark:border-blue-500 bg-blue-50/60 dark:bg-blue-950/25 text-blue-950 dark:text-blue-100 ring-1 ring-blue-500/30 shadow-2xs font-semibold'
                      : 'border-slate-200 dark:border-white/[0.07] bg-slate-50 dark:bg-[#101014] text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/[0.14]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Opt-In Encrypted Remote Backup Architecture */}
      <div className="bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">
            <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Encrypted Remote Backup (Opt-In)</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(settings.remoteBackupEnabled)}
              onChange={(e) => updateSettings({ remoteBackupEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-white/[0.1] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-transparent peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
          Zero-knowledge offsite backup. When activated, backups are client-side encrypted with AES-256-GCM before transfer. Remote hosts cannot view your notes, tasks, or files.
        </p>

        {settings.remoteBackupEnabled ? (
          <div className="p-3.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-blue-800 dark:text-blue-300">
              <Lock className="w-3.5 h-3.5" />
              <span>Client-Side Encryption Enabled</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              Connect via self-hosted WebDAV or custom S3 endpoint. Remote destinations are synced periodically according to your backup schedule.
            </p>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.06] flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Currently disabled. All data remains exclusively on your local device.</span>
          </div>
        )}
      </div>
    </div>
  );
};
