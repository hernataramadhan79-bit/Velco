import React from 'react';
import { Share2, X, Download, Copy, Check } from 'lucide-react';
import { Capsule } from '../../../types/capsule';

interface ShareCapsuleModalProps {
  isOpen: boolean;
  activeCapsule: Capsule | null;
  copiedKey: boolean;
  onCopyKey: (key: string) => void;
  onExportCapsule: () => void;
  onClose: () => void;
}

export const ShareCapsuleModal: React.FC<ShareCapsuleModalProps> = ({
  isOpen,
  activeCapsule,
  copiedKey,
  onCopyKey,
  onExportCapsule,
  onClose,
}) => {
  if (!isOpen || !activeCapsule) return null;

  return (
    <div className="fixed inset-0 bg-black/75 transform-gpu z-50 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.08] p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
              Share Capsule &bull; {activeCapsule.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 block mb-1">
              Invitation Key (Local / LAN Sync)
            </label>
            <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-2">
              <code className="font-mono text-[11px] text-blue-600 dark:text-blue-400 truncate">
                {activeCapsule.encryptionKey}
              </code>
              <button
                onClick={() => onCopyKey(activeCapsule.encryptionKey)}
                className="p-1 rounded bg-white dark:bg-white/[0.08] text-slate-600 dark:text-zinc-300 hover:bg-slate-200 transition-colors shrink-0 cursor-pointer"
                title="Copy Key"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-white/[0.05] flex items-center justify-between">
            <div>
              <span className="font-medium text-slate-700 dark:text-zinc-300 block text-xs">
                Portable Bundle (.vctx)
              </span>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                Export entire capsule with full notes and tasks
              </span>
            </div>
            <button
              onClick={() => {
                onExportCapsule();
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 text-slate-700 dark:text-zinc-300 text-xs font-medium cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
