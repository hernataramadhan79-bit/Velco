import React from 'react';
import { LogIn, X, Key, Upload } from 'lucide-react';

interface JoinCapsuleModalProps {
  isOpen: boolean;
  joinTab: 'key' | 'file';
  joinKeyInput: string;
  onJoinTabChange: (tab: 'key' | 'file') => void;
  onJoinKeyInputChange: (val: string) => void;
  onJoinByInput: (e: React.FormEvent) => void;
  onImportBundleFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
}

export const JoinCapsuleModal: React.FC<JoinCapsuleModalProps> = ({
  isOpen,
  joinTab,
  joinKeyInput,
  onJoinTabChange,
  onJoinKeyInputChange,
  onJoinByInput,
  onImportBundleFile,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 transform-gpu z-50 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.08] p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogIn className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
              Join or Import Capsule
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex rounded-lg bg-slate-100 dark:bg-[#101014] p-1 border border-slate-200/80 dark:border-white/[0.06]">
          <button
            type="button"
            onClick={() => onJoinTabChange('key')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              joinTab === 'key'
                ? 'bg-white dark:bg-[#18181e] text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Invitation Key</span>
          </button>
          <button
            type="button"
            onClick={() => onJoinTabChange('file')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              joinTab === 'file'
                ? 'bg-white dark:bg-[#18181e] text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>File .vctx</span>
          </button>
        </div>

        {joinTab === 'key' ? (
          <form onSubmit={onJoinByInput} className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 block mb-1">
                Peer Invitation Key
              </label>
              <input
                type="text"
                placeholder="Paste key (e.g. vctx_live_...) or exported JSON"
                value={joinKeyInput}
                onChange={(e) => onJoinKeyInputChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs font-mono text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1.5 leading-relaxed">
                Paste the invitation key copied from your peer&apos;s <strong>Share</strong> modal. Once joined, both of you can click <strong>Go Live</strong> to synchronize in real time via LAN.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-md bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 text-slate-700 dark:text-zinc-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!joinKeyInput.trim()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Join Capsule</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <label className="block p-5 border-2 border-dashed border-slate-200 dark:border-white/[0.1] hover:border-blue-500 rounded-xl text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-white/[0.02]">
              <Upload className="w-6 h-6 mx-auto text-blue-500 mb-2" />
              <span className="text-xs font-medium text-slate-800 dark:text-zinc-200 block mb-0.5">
                Select a .vctx or .json file
              </span>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">
                Imports complete workspace notes, tasks, and cryptographic key
              </span>
              <input
                type="file"
                accept=".vctx,.json"
                onChange={onImportBundleFile}
                className="hidden"
              />
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-md bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 text-slate-700 dark:text-zinc-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
