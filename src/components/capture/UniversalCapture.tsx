import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Link,
  FileText,
  CheckSquare,
  Paperclip,
  Image as ImageIcon,
  Sparkles,
  X,
} from 'lucide-react';
import { CreateItemInput, ItemType, PriorityLevel } from '../../types/item';

interface UniversalCaptureProps {
  onCapture: (input: CreateItemInput) => Promise<any>;
}

export const UniversalCapture: React.FC<UniversalCaptureProps> = ({ onCapture }) => {
  const [text, setText] = useState('');
  const [forcedType, setForcedType] = useState<ItemType | null>(null);
  const [taskPriority, setTaskPriority] = useState<PriorityLevel>('medium');
  const [taskDueDate, setTaskDueDate] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<
    { name: string; size: number; type: string; dataUrl?: string }[]
  >([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect item type from input text
  const detectedType: ItemType = React.useMemo(() => {
    if (forcedType) return forcedType;
    if (attachedFiles.length > 0) {
      if (attachedFiles.some((f) => f.type.startsWith('image/'))) return 'image';
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

  const processFiles = (files: File[]) => {
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedFiles((prev) => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            dataUrl: reader.result as string,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
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
        content: content || (detectedType === 'text' ? trimmed : ''),
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
      className={`relative w-full rounded-2xl transition-all duration-200 border shadow-sm ${
        isDragging
          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 ring-4 ring-blue-500/20'
          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus-within:border-blue-500/80 focus-within:ring-2 focus-within:ring-blue-500/15'
      }`}
    >
      <div className="p-4 pb-2">
        {/* Universal Capture Input Header */}
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            What do you want to save?
          </label>
          <div className="flex items-center gap-1">
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize border border-slate-200 dark:border-slate-700">
              Auto: {detectedType}
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
          placeholder="Type a note, paste a link, create a task (e.g. todo: call dentist), or drop files..."
          rows={2}
          className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none resize-none leading-relaxed"
        />

        {/* File Attachments Previews */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 my-2">
            {attachedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
              >
                {file.type.startsWith('image/') && file.dataUrl ? (
                  <img
                    src={file.dataUrl}
                    alt={file.name}
                    className="w-4 h-4 object-cover rounded"
                  />
                ) : (
                  <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span className="max-w-[140px] truncate font-medium">{file.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Optional Task metadata row if task detected */}
        {detectedType === 'task' && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs animate-in fade-in duration-100">
            <span className="text-slate-400 font-medium">Priority:</span>
            {(['low', 'medium', 'high', 'urgent'] as PriorityLevel[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTaskPriority(p)}
                className={`px-2 py-0.5 rounded capitalize font-medium transition-colors cursor-pointer ${
                  taskPriority === p
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border border-blue-300 dark:border-blue-700'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {p}
              </button>
            ))}
            <input
              type="date"
              value={taskDueDate}
              onChange={(e) => setTaskDueDate(e.target.value)}
              className="ml-auto px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
            />
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-950/40 rounded-b-2xl border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Quick type toggles */}
          <button
            type="button"
            onClick={() => setForcedType(forcedType === 'note' ? null : 'note')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              forcedType === 'note'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800'
            }`}
            title="Format as Note"
          >
            <FileText className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setForcedType(forcedType === 'task' ? null : 'task')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              forcedType === 'task'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800'
            }`}
            title="Format as Task"
          >
            <CheckSquare className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setForcedType(forcedType === 'link' ? null : 'link')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              forcedType === 'link'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800'
            }`}
            title="Format as Link"
          >
            <Link className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            <kbd className="px-1 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 font-mono text-[10px]">
              Ctrl+Enter
            </kbd>{' '}
            to save
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={(!text.trim() && attachedFiles.length === 0) || isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
