import React, { useState, useRef } from 'react';
import {
  Send,
  Link,
  FileText,
  CheckSquare,
  Paperclip,
  X,
} from 'lucide-react';
import { CreateItemInput, ItemType, PriorityLevel } from '../../types/item';
import { DueDatePicker } from '../tasks/DueDatePicker';
import { createImageThumbnail, inferMimeType, isImageFile } from '../../utils/fileUtils';

interface UniversalCaptureProps {
  onCapture: (input: CreateItemInput) => Promise<any>;
}

export const UniversalCapture: React.FC<UniversalCaptureProps> = ({ onCapture }) => {
  const [text, setText] = useState('');
  const [forcedType, setForcedType] = useState<ItemType | null>(null);
  const [taskPriority, setTaskPriority] = useState<PriorityLevel>('medium');
  const [taskDueDate, setTaskDueDate] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<
    { name: string; size: number; type: string; dataUrl?: string; textContent?: string }[]
  >([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect item type from input text
  const detectedType: ItemType = React.useMemo(() => {
    if (forcedType) return forcedType;
    if (attachedFiles.length > 0) {
      if (attachedFiles.some((f) => isImageFile(f.name, f.type))) return 'image';
      return 'file';
    }
    const trimmed = text.trim();
    if (/^(https?:\/\/|www\.)\S+$/i.test(trimmed)) return 'link';
    if (/^(\[ ?\]|todo:|task:|- \[ \])/i.test(trimmed)) return 'task';
    if (trimmed.includes('\n') || trimmed.length > 120) return 'note';
    return 'text';
  }, [text, forcedType, attachedFiles]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    processFiles(files);
  };

  const processFiles = async (files: File[]) => {
    for (const file of files) {
      let dataUrl: string | undefined = undefined;
      let textContent: string | undefined = undefined;
      const accurateMime = inferMimeType(file.name, file.type);
      const isImg = isImageFile(file.name, accurateMime);
      const isPdf = accurateMime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isText =
        accurateMime.startsWith('text/') ||
        accurateMime.includes('json') ||
        accurateMime.includes('javascript') ||
        /\.(txt|md|markdown|json|csv|log|js|jsx|ts|tsx|py|rs|html|css|xml|yaml|yml|sql|sh|bat|ini|env)$/i.test(
          file.name
        );

      if (isImg) {
        dataUrl = await createImageThumbnail(file, 480, 0.82);
      } else if (isPdf && file.size <= 20 * 1024 * 1024) {
        dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string) || undefined);
          reader.onerror = () => resolve(undefined);
          reader.readAsDataURL(file);
        });
      } else if (isText && file.size <= 5 * 1024 * 1024) {
        try {
          textContent = await file.text();
        } catch {
          /* fallback */
        }
      } else if (file.size < 5 * 1024 * 1024) {
        dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string) || undefined);
          reader.onerror = () => resolve(undefined);
          reader.readAsDataURL(file);
        });
      }

      setAttachedFiles((prev) => [
        ...prev,
        {
          name: file.name,
          size: file.size,
          type: accurateMime,
          dataUrl,
          textContent,
        },
      ]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed && attachedFiles.length === 0) return;

    setIsSaving(true);
    try {
      let title = trimmed;
      let content = '';
      let linkMeta = undefined;
      let taskMeta = undefined;

      if (detectedType === 'task') {
        const cleanTitle = trimmed.replace(/^(\[ ?\]|todo:|task:|- \[ \])/i, '').trim();
        title = cleanTitle || 'Untitled Task';
        taskMeta = {
          priority: taskPriority,
          completed: false,
          dueDate: taskDueDate || null,
        };
      } else if (detectedType === 'link') {
        const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
        try {
          const u = new URL(url);
          title = u.hostname.replace(/^www\./, '');
          linkMeta = {
            url,
            domain: u.hostname.replace(/^www\./, ''),
            pageTitle: title,
          };
        } catch {
          title = trimmed;
        }
      } else if (detectedType === 'note') {
        const lines = trimmed.split('\n');
        title = lines[0].replace(/^[#\s]+/, '').slice(0, 80) || 'Untitled Note';
        content = trimmed;
      } else if (attachedFiles.length > 0) {
        title = trimmed || attachedFiles[0].name;
        if (!content && attachedFiles[0].textContent) {
          content = attachedFiles[0].textContent;
        }
      }

      const attachmentsPayload = attachedFiles.map((f) => ({
        id: crypto.randomUUID(),
        fileName: f.name,
        filePath: `attachments/${f.name}`,
        mimeType: f.type,
        fileSize: f.size,
        checksum: 'local',
        createdAt: new Date().toISOString(),
        dataUrl: f.dataUrl,
      }));

      await onCapture({
        type: detectedType,
        title,
        content: content || (attachedFiles[0]?.textContent ? attachedFiles[0].textContent : (detectedType === 'text' ? trimmed : '')),
        task: taskMeta,
        link: linkMeta,
        attachments: attachmentsPayload,
      });

      // Clear input
      setText('');
      setAttachedFiles([]);
      setForcedType(null);
      setTaskDueDate('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error('Failed to capture item:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative w-full rounded-xl transition-all duration-200 border shadow-xs ${
        isDragging
          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 ring-2 ring-blue-500/20'
          : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141418] focus-within:border-blue-500/60 dark:focus-within:border-white/[0.18]'
      }`}
    >
      {/* Visual Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-blue-50/95 dark:bg-[#0f1424]/95 backdrop-blur-xs border-2 border-dashed border-blue-500 text-blue-600 dark:text-blue-400 pointer-events-none animate-in fade-in duration-150">
          <Paperclip className="w-6 h-6 mb-1.5 animate-bounce stroke-[2]" />
          <span className="text-xs font-semibold font-mono">Drop files or images here to attach</span>
        </div>
      )}

      <div className="p-3.5 pb-2">
        {/* Universal Capture Input Header */}
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Quick Capture
          </label>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-zinc-400 uppercase border border-slate-200 dark:border-white/[0.06]">
              AUTO: {detectedType}
            </span>
          </div>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 240)}px`;
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a note, paste a URL, capture a task (todo: ...), or drop attachments..."
          rows={2}
          className="w-full bg-transparent text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none resize-none leading-relaxed"
        />

        {/* File Attachments Previews */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06] my-2">
            {attachedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-2 py-1 rounded-md bg-slate-50 dark:bg-[#101014] text-xs text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.07]"
              >
                {(isImageFile(file.name, file.type) || file.type.startsWith('image/')) && file.dataUrl ? (
                  <img
                    src={file.dataUrl}
                    alt={file.name}
                    className="w-5 h-5 object-cover rounded border border-slate-200 dark:border-white/[0.1]"
                  />
                ) : (
                  <Paperclip className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                )}
                <span className="max-w-[140px] truncate font-medium text-[11px]">{file.name}</span>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Optional Task metadata row if task detected */}
        {detectedType === 'task' && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06] text-xs animate-in fade-in duration-100">
            <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-zinc-500">Priority:</span>
            {(['low', 'medium', 'high', 'urgent'] as PriorityLevel[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTaskPriority(p)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold transition-colors cursor-pointer ${
                  taskPriority === p
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 border border-slate-200/60 dark:border-white/[0.04]'
                }`}
              >
                {p}
              </button>
            ))}
            <DueDatePicker
              value={taskDueDate}
              onChange={setTaskDueDate}
              className="ml-auto"
            />
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="px-3 py-2 bg-slate-50/70 dark:bg-[#101014] rounded-b-xl border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* File picker */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
            title="Attach file"
          >
            <Paperclip className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>

          {/* Quick type toggles */}
          <button
            type="button"
            onClick={() => setForcedType(forcedType === 'note' ? null : 'note')}
            className={`p-1.5 rounded-md text-xs font-mono transition-colors cursor-pointer ${
              forcedType === 'note'
                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.05]'
            }`}
            title="Format as Note"
          >
            <FileText className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>

          <button
            type="button"
            onClick={() => setForcedType(forcedType === 'task' ? null : 'task')}
            className={`p-1.5 rounded-md text-xs font-mono transition-colors cursor-pointer ${
              forcedType === 'task'
                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.05]'
            }`}
            title="Format as Task"
          >
            <CheckSquare className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>

          <button
            type="button"
            onClick={() => setForcedType(forcedType === 'link' ? null : 'link')}
            className={`p-1.5 rounded-md text-xs font-mono transition-colors cursor-pointer ${
              forcedType === 'link'
                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.05]'
            }`}
            title="Format as Link"
          >
            <Link className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono hidden sm:inline">
            <kbd className="px-1 py-0.5 rounded bg-slate-200/70 dark:bg-white/[0.06] text-slate-500 dark:text-zinc-400">
              Ctrl+Enter
            </kbd>{' '}
            save
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={(!text.trim() && attachedFiles.length === 0) || isSaving}
            className="flex items-center gap-1.5 px-3 py-1.2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white text-xs font-mono font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Send className="w-3 h-3 stroke-[1.8]" />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
