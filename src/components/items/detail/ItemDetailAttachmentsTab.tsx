import React from 'react';
import { Paperclip } from 'lucide-react';
import { Attachment } from '../../../types/item';

interface ItemDetailAttachmentsTabProps {
  attachments?: Attachment[];
}

export const ItemDetailAttachmentsTab: React.FC<ItemDetailAttachmentsTabProps> = ({
  attachments,
}) => {
  if (!attachments || attachments.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-400 dark:text-zinc-500">
        No attachments
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {attachments.map((att) => (
        <div
          key={att.id}
          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs"
        >
          <div className="flex items-center gap-3">
            {att.mimeType.startsWith('image/') && att.dataUrl ? (
              <img
                src={att.dataUrl}
                alt={att.fileName}
                className="w-10 h-10 object-cover rounded-lg"
              />
            ) : (
              <div className="p-2 rounded-lg bg-slate-200 dark:bg-white/[0.08]">
                <Paperclip className="w-5 h-5 text-slate-500 dark:text-zinc-400" />
              </div>
            )}
            <div>
              <div className="font-semibold text-slate-900 dark:text-zinc-100">
                {att.fileName}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                {(att.fileSize / 1024).toFixed(1)} KB • {att.mimeType}
              </div>
            </div>
          </div>

          {att.dataUrl && (
            <a
              href={att.dataUrl}
              download={att.fileName}
              className="px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-800 dark:text-zinc-200 text-xs font-medium"
            >
              Download
            </a>
          )}
        </div>
      ))}
    </div>
  );
};
