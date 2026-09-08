import React, { useEffect } from 'react';
import { X, Download, ExternalLink, FileText, Calendar, HardDrive } from 'lucide-react';
import { ItemSummary } from '../../types/item';
import { formatFileSize, getFileTypeMeta, extractSizeFromContent } from '../../utils/fileUtils';

interface FileLightboxModalProps {
  item: ItemSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectDetail?: (item: ItemSummary) => void;
}

export const FileLightboxModal: React.FC<FileLightboxModalProps> = ({
  item,
  isOpen,
  onClose,
  onSelectDetail,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const meta = getFileTypeMeta(item.title);
  const isImage = meta.category === 'image' && !!item.thumbnailUrl;
  const contentSize = extractSizeFromContent(item.content || item.excerpt);
  const formattedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const handleDownload = () => {
    if (!item.thumbnailUrl) return;
    const a = document.createElement('a');
    a.href = item.thumbnailUrl;
    a.download = item.title || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.1] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#101014]/50">
          <div className="flex items-center gap-2.5 min-w-0 pr-4">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
            >
              {meta.extension}
            </span>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-200 truncate">
              {item.title}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isImage && (
              <button
                type="button"
                onClick={handleDownload}
                title="Download image"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            {onSelectDetail && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSelectDetail(item);
                }}
                title="Open full item detail"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Media / Preview Body */}
        <div className="flex-1 min-h-[300px] max-h-[calc(85vh-120px)] flex items-center justify-center p-6 bg-slate-900/[0.02] dark:bg-black/30 overflow-auto">
          {isImage ? (
            <img
              src={item.thumbnailUrl!}
              alt={item.title}
              className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm select-none"
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4 ${meta.iconBg} ${meta.iconColor}`}
              >
                <FileText className="w-10 h-10 stroke-[1.5]" />
              </div>
              <h4 className="text-base font-medium text-slate-800 dark:text-zinc-200 mb-1">
                {item.title}
              </h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md font-mono">
                {item.content || item.excerpt || 'No additional file content available'}
              </p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141418] text-xs text-slate-500 dark:text-zinc-400 font-mono">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {formattedDate}
            </span>
            {contentSize && (
              <span className="inline-flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                {contentSize}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onSelectDetail && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSelectDetail(item);
                }}
                className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-sans font-medium transition-colors cursor-pointer"
              >
                Open Details & AI
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
