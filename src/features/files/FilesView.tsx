import React, { useState, useRef } from 'react';
import { Item, CreateItemInput } from '../../types/item';
import { ItemCard } from '../../components/items/ItemCard';
import { Upload } from 'lucide-react';

interface FilesViewProps {
  files: Item[];
  onCapture: (input: CreateItemInput) => Promise<any>;
  onSelect: (item: Item) => void;
  onToggleFavorite: (itemId: string) => void;
  onTrash: (itemId: string) => void;
}

export const FilesView: React.FC<FilesViewProps> = ({
  files,
  onCapture,
  onSelect,
  onToggleFavorite,
  onTrash,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

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
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFiles = (fileList: FileList) => {
    Array.from(fileList).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        onCapture({
          type: file.type.startsWith('image/') ? 'image' : 'file',
          title: file.name,
          content: `File: ${file.name}\nSize: ${(file.size / 1024).toFixed(1)} KB\nType: ${file.type}`,
          attachments: [
            {
              id: crypto.randomUUID(),
              fileName: file.name,
              filePath: `attachments/${file.name}`,
              mimeType: file.type || 'application/octet-stream',
              fileSize: file.size,
              checksum: 'local',
              createdAt: new Date().toISOString(),
              dataUrl: reader.result as string,
            },
          ],
        });
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* File Upload Drop Area */}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`p-8 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all duration-150 group ${
          isDragging
            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
            : 'border-slate-300 dark:border-slate-800 hover:border-blue-500/80 bg-white/40 dark:bg-slate-900/40'
        }`}
      >
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-blue-500 mx-auto mb-2 transition-colors">
          <Upload className="w-5 h-5" />
        </div>
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          Click or drop files to import into Velco
        </div>
        <div className="text-[11px] text-slate-400 mt-1">
          PDF, TXT, MD, Images, Audio, Documents (stored locally in Velco/attachments)
        </div>
      </div>

      {/* Files List */}
      <div className="space-y-3">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          Files & Attachments ({files.length})
        </div>
        <div className="space-y-2.5">
          {files.length === 0 ? (
            <div className="text-center py-16 text-xs text-slate-400">
              No files saved yet.
            </div>
          ) : (
            files.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onSelect={onSelect}
                onToggleFavorite={onToggleFavorite}
                onTrash={onTrash}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
