import React from 'react';
import { FolderGit2, X } from 'lucide-react';

interface NewCapsuleModalProps {
  isOpen: boolean;
  name: string;
  description: string;
  onNameChange: (name: string) => void;
  onDescriptionChange: (desc: string) => void;
  onCreateCapsule: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const NewCapsuleModal: React.FC<NewCapsuleModalProps> = ({
  isOpen,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onCreateCapsule,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 transform-gpu z-50 flex items-center justify-center p-4 select-none">
      <form
        onSubmit={onCreateCapsule}
        className="w-full max-w-md bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.08] p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-100"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
              New Context Capsule
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 block mb-1">
              Name
            </label>
            <input
              type="text"
              placeholder="e.g. Project Roadmap, Architecture Review..."
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 block mb-1">
              Description (Optional)
            </label>
            <textarea
              placeholder="Scope or brief of this capsule..."
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              rows={2}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="pt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 text-slate-700 dark:text-zinc-300 text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
};
