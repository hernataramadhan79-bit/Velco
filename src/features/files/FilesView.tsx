import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Upload,
  FileIcon,
  LayoutGrid,
  List,
  Search,
  ArrowUpDown,
  X,
  ImageIcon,
  FileText,
  Music,
  Archive,
  Code,
  FolderOpen,
} from 'lucide-react';
import { ItemSummary, CreateItemInput } from '../../types/item';
import { EmptyState } from '../../components/common/EmptyState';
import { FileGridCard } from './FileGridCard';
import { FileListRow } from './FileListRow';
import { FileLightboxModal } from './FileLightboxModal';
import { FileCategory, getFileCategory, extractSizeFromContent, createImageThumbnail } from '../../utils/fileUtils';
import { useSelectionStore } from '../../stores/selectionStore';

interface FilesViewProps {
  files: ItemSummary[];
  onCapture: (input: CreateItemInput) => Promise<any>;
  onSelect: (item: ItemSummary) => void;
  onToggleFavorite: (itemId: string) => void;
  onTrash: (itemId: string) => void;
  isDraggingFiles?: boolean;
}

type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';

const VIEW_MODE_KEY = 'velco_files_view_mode';

export const FilesView: React.FC<FilesViewProps> = ({
  files,
  onCapture,
  onSelect,
  onToggleFavorite,
  onTrash,
  isDraggingFiles = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const activeDragging = isDragging || isDraggingFiles;

  // View Mode: 'grid' | 'list'
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem(VIEW_MODE_KEY) as 'grid' | 'list') || 'grid';
  });

  const handleToggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');

  // Lightbox Preview Modal
  const [previewItem, setPreviewItem] = useState<ItemSummary | null>(null);

  // Selection Store
  const selectedIds = useSelectionStore((state) => state.selectedIds);
  const selectAll = useSelectionStore((state) => state.selectAll);
  const clearSelection = useSelectionStore((state) => state.clearSelection);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = {
      all: files.length,
      image: 0,
      document: 0,
      media: 0,
      archive: 0,
      code: 0,
      other: 0,
    };

    files.forEach((f) => {
      const cat = getFileCategory(f.title);
      if (cat in counts) {
        counts[cat]++;
      } else {
        counts.other++;
      }
    });

    return counts;
  }, [files]);

  // Filtered & Sorted files
  const displayedFiles = useMemo(() => {
    let list = files.filter((f) => {
      // Category filter
      if (selectedCategory !== 'all') {
        const cat = getFileCategory(f.title);
        if (cat !== selectedCategory) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (f.title || '').toLowerCase().includes(q);
        const matchesExcerpt = (f.excerpt || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesExcerpt) return false;
      }

      return true;
    });

    // Sorting
    list.sort((a, b) => {
      switch (sortBy) {
        case 'date-asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'name-asc':
          return (a.title || '').localeCompare(b.title || '');
        case 'name-desc':
          return (b.title || '').localeCompare(a.title || '');
        case 'date-desc':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return list;
  }, [files, selectedCategory, searchQuery, sortBy]);

  const allDisplayedIds = displayedFiles.map((f) => f.id);
  const allSelected =
    allDisplayedIds.length > 0 && allDisplayedIds.every((id) => selectedIds.has(id));
  const someSelected = allDisplayedIds.some((id) => selectedIds.has(id));

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

  const handleFiles = async (fileList: FileList) => {
    const filesArray = Array.from(fileList);
    for (const file of filesArray) {
      let dataUrl: string | undefined = undefined;
      let textContent: string | undefined = undefined;
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isText =
        file.type.startsWith('text/') ||
        file.type.includes('json') ||
        file.type.includes('javascript') ||
        /\.(txt|md|markdown|json|csv|log|js|jsx|ts|tsx|py|rs|html|css|xml|yaml|yml|sql|sh|bat|ini|env)$/i.test(
          file.name
        );

      if (isImage) {
        dataUrl = await createImageThumbnail(file, 480, 0.8);
      } else if (isPdf && file.size <= 15 * 1024 * 1024) {
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
      } else if (file.size < 2 * 1024 * 1024) {
        dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string) || undefined);
          reader.onerror = () => resolve(undefined);
          reader.readAsDataURL(file);
        });
      }

      const content =
        textContent ||
        `File: ${file.name}\nSize: ${(file.size / 1024).toFixed(1)} KB\nType: ${file.type}`;

      await onCapture({
        type: isImage ? 'image' : 'file',
        title: file.name,
        content,
        attachments: [
          {
            id: crypto.randomUUID(),
            fileName: file.name,
            filePath: `attachments/${file.name}`,
            mimeType: file.type || 'application/octet-stream',
            fileSize: file.size,
            checksum: 'local',
            createdAt: new Date().toISOString(),
            dataUrl,
          },
        ],
      });
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 pb-16">
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
        className={`p-6 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all duration-200 group ${
          activeDragging
            ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 ring-4 ring-blue-500/10 scale-[1.005]'
            : 'border-slate-300/80 dark:border-white/[0.1] hover:border-blue-500/80 dark:hover:border-white/[0.25] bg-white/70 dark:bg-[#141418]/60 shadow-xs'
        }`}
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 transition-all ${
            activeDragging
              ? 'bg-blue-500 text-white scale-110'
              : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 group-hover:text-blue-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/30'
          }`}
        >
          <Upload className="w-5 h-5 stroke-[1.8]" />
        </div>
        <div className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
          {activeDragging ? 'Drop files to import into Velco' : 'Click or drop files to import into Velco'}
        </div>
        <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 font-mono">
          Images (PNG, JPG, WEBP), PDFs, Documents, Media & Code files stored safely
        </div>
      </div>

      {/* ── File Explorer Toolbar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xs">
        {/* Left: Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>All</span>
            <span className="font-mono text-[10px] opacity-75">{categoryCounts.all}</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('image')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              selectedCategory === 'image'
                ? 'bg-sky-600 text-white dark:bg-sky-500 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-sky-500" />
            <span>Images</span>
            <span className="font-mono text-[10px] opacity-75">{categoryCounts.image}</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('document')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              selectedCategory === 'document'
                ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-blue-500" />
            <span>Docs & PDFs</span>
            <span className="font-mono text-[10px] opacity-75">{categoryCounts.document}</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('media')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              selectedCategory === 'media'
                ? 'bg-purple-600 text-white dark:bg-purple-500 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Music className="w-3.5 h-3.5 text-purple-500" />
            <span>Media</span>
            <span className="font-mono text-[10px] opacity-75">{categoryCounts.media}</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('archive')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              selectedCategory === 'archive'
                ? 'bg-amber-600 text-white dark:bg-amber-500 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Archive className="w-3.5 h-3.5 text-amber-500" />
            <span>Archives</span>
            <span className="font-mono text-[10px] opacity-75">{categoryCounts.archive}</span>
          </button>
        </div>

        {/* Right: Search, Sort & View Mode Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Search files */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-8 pr-7 py-1 text-xs rounded-lg bg-slate-50 dark:bg-zinc-800/70 border border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 focus:outline-none focus:border-blue-500/60"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="pl-2.5 pr-6 py-1 text-xs rounded-lg bg-slate-50 dark:bg-zinc-800/70 border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-zinc-300 focus:outline-none cursor-pointer appearance-none font-medium"
            >
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
            </select>
            <ArrowUpDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* View Mode Toggle (Grid vs List) */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => handleToggleViewMode('grid')}
              title="Grid View (File Explorer)"
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-100 shadow-2xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleToggleViewMode('list')}
              title="List View (Detailed)"
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-100 shadow-2xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Selection Action Bar (if items selected) ── */}
      {someSelected && (
        <div className="flex items-center justify-between px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs font-mono text-blue-900 dark:text-blue-200 animate-in fade-in">
          <label className="flex items-center gap-2 cursor-pointer font-medium">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => {
                if (e.target.checked) {
                  selectAll(allDisplayedIds);
                } else {
                  clearSelection();
                }
              }}
              className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
            />
            <span>
              {allSelected
                ? `All ${displayedFiles.length} files selected`
                : `${selectedIds.size} files selected`}
            </span>
          </label>
          <button
            type="button"
            onClick={clearSelection}
            className="text-[11px] underline hover:text-blue-700 dark:hover:text-blue-100 cursor-pointer"
          >
            Deselect
          </button>
        </div>
      )}

      {/* ── Content Container (Grid or List) ── */}
      {displayedFiles.length === 0 ? (
        <EmptyState
          icon={FileIcon}
          title={searchQuery || selectedCategory !== 'all' ? 'No matching files' : 'No files attached yet'}
          description={
            searchQuery || selectedCategory !== 'all'
              ? 'Try changing your search keywords or switching category filters.'
              : 'Drop images, PDFs, code snippets, or documents here to get started.'
          }
          action={
            searchQuery || selectedCategory !== 'all'
              ? {
                  label: 'Reset Filters',
                  onClick: () => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  },
                  icon: X,
                }
              : {
                  label: 'Choose Files to Upload',
                  onClick: () => inputRef.current?.click(),
                  icon: Upload,
                }
          }
          badgeIcon={FileIcon}
        />
      ) : viewMode === 'grid' ? (
        /* Grid Mode */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {displayedFiles.map((item) => (
            <FileGridCard
              key={item.id}
              item={item}
              onSelect={onSelect}
              onQuickPreview={(it) => setPreviewItem(it)}
              onToggleFavorite={onToggleFavorite}
              onTrash={onTrash}
            />
          ))}
        </div>
      ) : (
        /* List Mode */
        <div className="space-y-2">
          {displayedFiles.map((item) => (
            <FileListRow
              key={item.id}
              item={item}
              onSelect={onSelect}
              onQuickPreview={(it) => setPreviewItem(it)}
              onToggleFavorite={onToggleFavorite}
              onTrash={onTrash}
            />
          ))}
        </div>
      )}

      {/* ── Lightbox Quick Preview Modal ── */}
      <FileLightboxModal
        item={previewItem}
        isOpen={previewItem !== null}
        onClose={() => setPreviewItem(null)}
        onSelectDetail={(it) => {
          setPreviewItem(null);
          onSelect(it);
        }}
      />
    </div>
  );
};
