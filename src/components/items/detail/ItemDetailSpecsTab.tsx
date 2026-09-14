import React from 'react';
import { Download } from 'lucide-react';
import { Item, Attachment } from '../../../types/item';
import { formatFileSize } from '../../../utils/fileUtils';

interface ItemDetailSpecsTabProps {
  item: Item;
  activeFileName: string;
  activeMeta: any;
  activeAttachment?: Attachment;
  activePreviewUrl: string | null;
  onDownloadAttachment: () => void;
}

export const ItemDetailSpecsTab: React.FC<ItemDetailSpecsTabProps> = ({
  item,
  activeFileName,
  activeMeta,
  activeAttachment,
  activePreviewUrl,
  onDownloadAttachment,
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-zinc-500">File Name</span>
          <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 break-all">
            {activeFileName}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-zinc-500">Extension &amp; Category</span>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${activeMeta.badgeBg} ${activeMeta.badgeText} ${activeMeta.badgeBorder}`}>
              {activeMeta.extension}
            </span>
            <span className="text-xs text-slate-700 dark:text-zinc-300 capitalize">
              {activeMeta.category}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-zinc-500">File Size</span>
          <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 font-mono">
            {formatFileSize(activeAttachment?.fileSize)}
            {activeAttachment?.fileSize ? ` (${activeAttachment.fileSize.toLocaleString()} bytes)` : ''}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-zinc-500">MIME Type</span>
          <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 font-mono">
            {activeAttachment?.mimeType || 'application/octet-stream'}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-zinc-500">Storage Path</span>
          <p className="text-xs font-mono text-slate-600 dark:text-zinc-400 break-all">
            {activeAttachment?.filePath || `attachments/${activeFileName}`}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-zinc-500">Date Added</span>
          <p className="text-xs font-mono text-slate-600 dark:text-zinc-400">
            {new Date(activeAttachment?.createdAt || item.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      {activePreviewUrl && (
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onDownloadAttachment}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download {activeFileName}</span>
          </button>
        </div>
      )}
    </div>
  );
};
