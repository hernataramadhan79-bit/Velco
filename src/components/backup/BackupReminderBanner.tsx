import React, { useState, useEffect } from 'react';
import { useSettings } from '../../stores/settingsStore';
import { db } from '../../services/database';
import { ShieldAlert, Download, X, CheckCircle2 } from 'lucide-react';

export const BackupReminderBanner: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const [snoozed, setSnoozed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Check if reminder is due
  const reminderDays = settings.backupReminderDays ?? 7;
  const lastBackup = settings.lastBackupTimestamp;

  const isDue = (() => {
    if (reminderDays <= 0) return false;
    if (snoozed) return false;
    if (!lastBackup) return true; // Never backed up
    const diffDays = (Date.now() - lastBackup) / (1000 * 60 * 60 * 24);
    return diffDays >= reminderDays;
  })();

  const daysSince = lastBackup
    ? Math.floor((Date.now() - lastBackup) / (1000 * 60 * 60 * 24))
    : null;

  const handleExport = async () => {
    setIsExporting(true);
    let url: string | null = null;
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

      updateSettings({ lastBackupTimestamp: Date.now() });
      setSuccessMsg('Backup saved successfully.');
      setTimeout(() => {
        setSuccessMsg(null);
        setSnoozed(true);
      }, 2500);
    } catch (err: any) {
      console.error('Backup failed:', err);
    } finally {
      setIsExporting(false);
      if (url) setTimeout(() => URL.revokeObjectURL(url as string), 5000);
    }
  };

  if (!isDue) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 select-none animate-in slide-in-from-top-2 duration-150 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="truncate">
          {successMsg ? (
            <span className="text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {successMsg}
            </span>
          ) : daysSince === null ? (
            <span>You haven&apos;t created a local backup yet. Safeguard your database against unexpected data loss.</span>
          ) : (
            <span>It has been <strong>{daysSince} days</strong> since your last local backup.</span>
          )}
        </span>
      </div>

      {!successMsg && (
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium text-[11px] flex items-center gap-1 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3 h-3" />
            <span>{isExporting ? 'Exporting...' : 'Backup Now'}</span>
          </button>
          <button
            type="button"
            onClick={() => setSnoozed(true)}
            className="p-1 text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-100 rounded transition-colors cursor-pointer"
            title="Dismiss for this session"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
