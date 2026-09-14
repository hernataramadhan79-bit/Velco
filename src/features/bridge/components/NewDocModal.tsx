import React from 'react';
import { FileText, X } from 'lucide-react';

interface NewDocModalProps {
  isOpen: boolean;
  capsuleName?: string;
  title: string;
  content: string;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onCreateDoc: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const NewDocModal: React.FC<NewDocModalProps> = ({
  isOpen,
  capsuleName,
  title,
  content,
  onTitleChange,
  onContentChange,
  onCreateDoc,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 transform-gpu z-50 flex items-center justify-center p-4 select-none">
      <form
        onSubmit={onCreateDoc}
        className="w-full max-w-lg bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.08] p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-100"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
              New Note {capsuleName ? `• ${capsuleName}` : ''}
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
              Title
            </label>
            <input
              type="text"
              placeholder="e.g. Architecture Specs, Meeting Notes..."
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 block mb-1">
              Content (Markdown)
            </label>
            <textarea
              placeholder="Write markdown note..."
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
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
            disabled={!title.trim()}
            className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
          >
            Create Note
          </button>
        </div>
      </form>
    </div>
  );
};
