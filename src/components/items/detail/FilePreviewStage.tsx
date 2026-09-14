import React from 'react';
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  Download,
  Loader2,
  ExternalLink,
  Music,
  FileText,
  Copy,
  Check,
  Paperclip,
} from 'lucide-react';
import { Attachment, FilePreviewContent } from '../../../types/item';
import { formatFileSize } from '../../../utils/fileUtils';
import { MarkdownViewer } from '../../common/MarkdownViewer';
import { CsvPreviewTable } from './CsvPreviewTable';

interface FilePreviewStageProps {
  hasFiles: boolean;
  activeMeta: any;
  activeFileName: string;
  activeAttachment?: Attachment;
  isImage: boolean;
  isPdf: boolean;
  isVideo: boolean;
  isAudio: boolean;
  isTextLike: boolean;
  isMarkdown: boolean;
  isCsv: boolean;
  isDocx: boolean;
  isCode: boolean;
  isZoomed: boolean;
  loadingPreview: boolean;
  resolvedPreviewUrl: string | null;
  pdfBlobUrl: string | null;
  resolvedTextContent: string | null;
  textPreviewMode: 'formatted' | 'raw';
  copiedPreviewText: boolean;
  filePreview: FilePreviewContent | null;
  selectedAttachmentIdx: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  onToggleZoom: () => void;
  onOpenLightbox: () => void;
  onDownloadAttachment: (att?: Attachment) => void;
  onOpenInSystemViewer: () => void;
  onSetTextPreviewMode: (mode: 'formatted' | 'raw') => void;
  onCopyPreviewText: (text: string) => void;
  onSelectAttachmentIdx: (idx: number) => void;
  attachments?: Attachment[];
}

export const FilePreviewStage: React.FC<FilePreviewStageProps> = ({
  hasFiles,
  activeMeta,
  activeFileName,
  activeAttachment,
  isImage,
  isPdf,
  isVideo,
  isAudio,
  isTextLike,
  isMarkdown,
  isCsv,
  isDocx,
  isCode,
  isZoomed,
  loadingPreview,
  resolvedPreviewUrl,
  pdfBlobUrl,
  resolvedTextContent,
  textPreviewMode,
  copiedPreviewText,
  filePreview,
  selectedAttachmentIdx,
  videoRef,
  audioRef,
  onToggleZoom,
  onOpenLightbox,
  onDownloadAttachment,
  onOpenInSystemViewer,
  onSetTextPreviewMode,
  onCopyPreviewText,
  onSelectAttachmentIdx,
  attachments,
}) => {
  if (!hasFiles) return null;

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/[0.1] bg-slate-900/[0.03] dark:bg-black/40 shadow-xs">
      {/* Stage Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141418]">
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide border ${activeMeta.badgeBg} ${activeMeta.badgeText} ${activeMeta.badgeBorder}`}
          >
            {activeMeta.extension}
          </span>
          <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">
            {activeFileName}
          </span>
          {activeAttachment?.fileSize ? (
            <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono shrink-0">
              • {formatFileSize(activeAttachment.fileSize)}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isImage && (
            <button
              type="button"
              onClick={onToggleZoom}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              title={isZoomed ? 'Fit to frame' : 'Zoom 100%'}
            >
              {isZoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
            </button>
          )}

          {isImage && (
            <button
              type="button"
              onClick={onOpenLightbox}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              title="Fullscreen Lightbox"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          {resolvedPreviewUrl && (
            <button
              type="button"
              onClick={() => onDownloadAttachment()}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              title="Download file"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stage Body */}
      <div
        className={`relative flex items-center justify-center min-h-[220px] max-h-[500px] overflow-auto p-4 ${
          isImage ? (isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in') : ''
        }`}
      >
        {loadingPreview ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 dark:text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mb-2 text-blue-500" />
            <span className="text-xs font-medium">Loading file content preview...</span>
          </div>
        ) : isImage && resolvedPreviewUrl ? (
          <img
            src={resolvedPreviewUrl}
            alt={activeFileName}
            onClick={onOpenLightbox}
            className={`transition-all duration-200 select-none rounded-xl shadow-sm ${
              isZoomed
                ? 'max-w-none object-none'
                : 'max-w-full max-h-[440px] object-contain'
            }`}
          />
        ) : isPdf && (resolvedPreviewUrl || pdfBlobUrl) ? (
          <div className="w-full h-[460px] flex flex-col rounded-xl overflow-hidden bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08] shadow-inner">
            <div className="flex items-center justify-between px-3.5 py-2 bg-slate-200/80 dark:bg-white/[0.06] border-b border-slate-300 dark:border-white/[0.08] text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-red-500" />
                  <span>PDF Document</span>
                </span>
                {activeAttachment?.fileSize ? (
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                    • {formatFileSize(activeAttachment.fileSize)}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenInSystemViewer}
                  className="px-2.5 py-1 rounded text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Open PDF in system default viewer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open in Default App</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDownloadAttachment()}
                  className="px-2.5 py-1 rounded text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>
            <object
              data={pdfBlobUrl || resolvedPreviewUrl || undefined}
              type="application/pdf"
              className="w-full flex-1 border-0 bg-white dark:bg-zinc-950"
            >
              <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-zinc-900/60 h-full">
                <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-500 mb-3">
                  <FileText className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200 mb-1">
                  PDF Document Preview
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 max-w-sm">
                  Open the document directly in your system's default PDF viewer for the best reading experience.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenInSystemViewer}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open in Default App</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownloadAttachment()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-700 dark:text-zinc-200 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>
            </object>
          </div>
        ) : isVideo && resolvedPreviewUrl ? (
          <video
            ref={videoRef as any}
            src={resolvedPreviewUrl}
            controls
            className="w-full max-h-[440px] rounded-xl bg-black shadow-md"
          />
        ) : isAudio && resolvedPreviewUrl ? (
          <div className="w-full max-w-md p-6 flex flex-col items-center gap-4 bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Music className="w-7 h-7" />
            </div>
            <div className="text-center">
              <h4 className="font-semibold text-slate-800 dark:text-zinc-200 text-sm">
                {activeFileName}
              </h4>
              <span className="text-xs text-slate-400 dark:text-zinc-500 font-mono">
                {formatFileSize(activeAttachment?.fileSize)} • Audio File
              </span>
            </div>
            <audio ref={audioRef as any} src={resolvedPreviewUrl} controls className="w-full" />
          </div>
        ) : isTextLike && resolvedTextContent ? (
          <div className="w-full h-[460px] flex flex-col rounded-xl overflow-hidden bg-white dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] shadow-inner text-left">
            <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/[0.08] text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide border uppercase ${activeMeta.badgeBg} ${activeMeta.badgeText} ${activeMeta.badgeBorder}`}>
                  {isMarkdown ? 'Markdown' : isCsv ? 'CSV Table' : isDocx ? 'Word Document' : isCode ? (filePreview?.language?.toUpperCase() || 'Code') : 'Text Preview'}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                  {resolvedTextContent.split('\n').length} lines • {resolvedTextContent.length.toLocaleString()} chars
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {(isMarkdown || isCsv) && (
                  <div className="flex items-center rounded-lg border border-slate-200 dark:border-white/[0.08] p-0.5 bg-slate-100 dark:bg-white/[0.05]">
                    <button
                      type="button"
                      onClick={() => onSetTextPreviewMode('formatted')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        textPreviewMode === 'formatted'
                          ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-2xs font-semibold'
                          : 'text-slate-500 dark:text-zinc-400'
                      }`}
                    >
                      {isCsv ? 'Table' : 'Rendered'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetTextPreviewMode('raw')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        textPreviewMode === 'raw'
                          ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-2xs font-semibold'
                          : 'text-slate-500 dark:text-zinc-400'
                      }`}
                    >
                      Raw
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onCopyPreviewText(resolvedTextContent)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/[0.08] flex items-center gap-1 transition-colors cursor-pointer"
                  title="Copy text to clipboard"
                >
                  {copiedPreviewText ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>

                {resolvedPreviewUrl && (
                  <button
                    type="button"
                    onClick={() => onDownloadAttachment()}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 text-xs leading-relaxed">
              {isMarkdown && textPreviewMode === 'formatted' ? (
                <MarkdownViewer content={resolvedTextContent} />
              ) : isCsv && textPreviewMode === 'formatted' ? (
                <CsvPreviewTable content={resolvedTextContent} />
              ) : isDocx ? (
                <div className="space-y-3 font-sans text-sm text-slate-800 dark:text-zinc-200 max-w-3xl mx-auto py-2">
                  {resolvedTextContent.split('\n').filter(Boolean).map((para, pIdx) => (
                    <p key={pIdx} className="leading-relaxed">
                      {para}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="flex font-mono text-[11px] leading-5">
                  <div className="select-none pr-3 text-right text-slate-400 dark:text-zinc-600 border-r border-slate-200 dark:border-white/[0.08] min-w-[32px]">
                    {resolvedTextContent.split('\n').map((_, lIdx) => (
                      <div key={lIdx}>{lIdx + 1}</div>
                    ))}
                  </div>
                  <div className="pl-3 flex-1 overflow-x-auto text-slate-800 dark:text-zinc-200 whitespace-pre">
                    {resolvedTextContent}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-sm ${activeMeta.iconBg} ${activeMeta.iconColor}`}
            >
              <FileText className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-zinc-200 mb-1 max-w-md truncate">
              {activeFileName}
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono mb-4">
              {formatFileSize(activeAttachment?.fileSize)} • {activeMeta.category.toUpperCase()} •{' '}
              {activeAttachment?.mimeType || 'Standard file'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenInSystemViewer}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Default App</span>
              </button>
              {resolvedPreviewUrl && (
                <button
                  type="button"
                  onClick={() => onDownloadAttachment()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-700 dark:text-zinc-200 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download File</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Multiple Attachments Thumbnail Selector Strip */}
      {attachments && attachments.length > 1 && (
        <div className="flex items-center gap-2 p-2.5 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#101014]/70 overflow-x-auto">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 shrink-0">
            Files ({attachments.length}):
          </span>
          {attachments.map((att, idx) => {
            const isImg =
              att.mimeType.startsWith('image/') ||
              att.fileName.match(/\.(png|jpe?g|webp|gif|svg)$/i);
            const isSelected = selectedAttachmentIdx === idx;
            return (
              <button
                key={att.id || idx}
                type="button"
                onClick={() => onSelectAttachmentIdx(idx)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold ring-1 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141418] text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/[0.14]'
                }`}
              >
                {isImg && att.dataUrl ? (
                  <img
                    src={att.dataUrl}
                    alt={att.fileName}
                    className="w-4 h-4 object-cover rounded"
                  />
                ) : (
                  <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span className="max-w-[120px] truncate">{att.fileName}</span>
                <span className="text-[10px] font-mono text-slate-400">
                  {formatFileSize(att.fileSize)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
