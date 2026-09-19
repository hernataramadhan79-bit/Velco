import React from 'react';
import {
  FileText,
  Plus,
  Search,
  Edit3,
  Save,
  Copy,
  Trash2,
  Check,
} from 'lucide-react';
import { ItemSummary, Item } from '../../../types/item';
import { MarkdownViewer } from '../../../components/common/MarkdownViewer';

interface CapsuleDocEditorProps {
  docs: ItemSummary[];
  filteredDocs: ItemSummary[];
  selectedDocId: string | null;
  fullDocItem: Item | null;
  docSearchQuery: string;
  isDocEditing: boolean;
  isSavingDoc: boolean;
  editingDocTitle: string;
  editingDocContent: string;
  copiedDoc: boolean;
  onDocSearchChange: (q: string) => void;
  onSelectDoc: (id: string) => void;
  onOpenNewDocModal: () => void;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onTitleChange: (t: string) => void;
  onContentChange: (c: string) => void;
  onSaveDoc: () => void;
  onCopyDoc: (text: string) => void;
  onRemoveDoc: (id: string, title: string) => void;
}

export const CapsuleDocEditor: React.FC<CapsDocEditorProps> = ({
  docs,
  filteredDocs,
  selectedDocId,
  fullDocItem,
  docSearchQuery,
  isDocEditing,
  isSavingDoc,
  editingDocTitle,
  editingDocContent,
  copiedDoc,
  onDocSearchChange,
  onSelectDoc,
  onOpenNewDocModal,
  onStartEditing,
  onCancelEditing,
  onTitleChange,
  onContentChange,
  onSaveDoc,
  onCopyDoc,
  onRemoveDoc,
}) => {
  return (
    <div className="flex-1 flex min-h-0 max-w-full overflow-hidden">
      {/* Left Sub-list of Notes */}
      <div className="w-64 border-r border-slate-200 dark:border-white/[0.07] bg-slate-50/40 dark:bg-[#0c0c0f] flex flex-col shrink-0">
        <div className="p-2.5 border-b border-slate-200 dark:border-white/[0.07] flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
            Notes ({docs.length})
          </span>
          <button
            onClick={onOpenNewDocModal}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>New Note</span>
          </button>
        </div>

        {docs.length > 3 && (
          <div className="p-2 border-b border-slate-200/60 dark:border-white/[0.05]">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
              <input
                type="text"
                placeholder="Filter notes..."
                value={docSearchQuery}
                onChange={(e) => onDocSearchChange(e.target.value)}
                className="w-full pl-6 pr-2 py-1 rounded bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.07] text-[11px] text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1">
          {filteredDocs.map((doc) => {
            const isSelected = doc.id === selectedDocId;

            return (
              <button
                key={doc.id}
                onClick={() => onSelectDoc(doc.id)}
                className={`w-full text-left p-2 rounded-lg text-xs transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white dark:bg-[#141418] text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/30 shadow-2xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-white/60 dark:hover:bg-white/[0.03] border border-transparent'
                }`}
              >
                <div className="truncate">{doc.title}</div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 line-clamp-1 mt-0.5">
                  {doc.excerpt || 'Empty note'}
                </div>
              </button>
            );
          })}

          {filteredDocs.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400 dark:text-zinc-500 space-y-2">
              <FileText className="w-6 h-6 mx-auto stroke-[1.5] text-slate-300 dark:text-zinc-600" />
              <p className="text-[11px]">No documents</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Document Detail & Editor */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 max-w-full bg-white dark:bg-[#09090b] overflow-hidden">
        {fullDocItem ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Note Toolbar */}
            <div className="px-6 py-2.5 border-b border-slate-200 dark:border-white/[0.07] flex items-center justify-between gap-4 shrink-0 bg-white/50 dark:bg-[#09090b]">
              <div className="min-w-0 flex-1">
                {isDocEditing ? (
                  <input
                    type="text"
                    value={editingDocTitle}
                    onChange={(e) => onTitleChange(e.target.value)}
                    className="w-full text-sm font-bold text-slate-900 dark:text-zinc-100 bg-transparent border-b border-blue-500 focus:outline-none pb-0.5"
                  />
                ) : (
                  <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">
                    {fullDocItem.title}
                  </h3>
                )}
                <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                  Updated {fullDocItem.updatedAt ? new Date(fullDocItem.updatedAt).toLocaleDateString() : 'recently'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Preview / Edit Mode Switch */}
                <button
                  onClick={() => {
                    if (isDocEditing) {
                      onSaveDoc();
                    } else {
                      onStartEditing();
                    }
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
                    isDocEditing
                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-500'
                      : 'bg-slate-100 dark:bg-white/[0.05] border-slate-200 dark:border-white/[0.07] text-slate-700 dark:text-zinc-300 hover:bg-slate-200'
                  }`}
                >
                  {isDocEditing ? (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingDoc ? 'Saving...' : 'Save'}</span>
                    </>
                  ) : (
                    <>
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </>
                  )}
                </button>

                {isDocEditing && (
                  <button
                    onClick={onCancelEditing}
                    className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                )}

                <button
                  onClick={() => onCopyDoc(fullDocItem.content || '')}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                  title="Copy Markdown"
                >
                  {copiedDoc ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={() => onRemoveDoc(fullDocItem.id, fullDocItem.title)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                  title="Remove from Capsule"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Note Content Area */}
            <div className="flex-1 p-6 overflow-y-auto overflow-x-hidden min-h-0">
              {isDocEditing ? (
                <textarea
                  value={editingDocContent}
                  onChange={(e) => onContentChange(e.target.value)}
                  placeholder="Write markdown content..."
                  className="w-full h-full min-h-[350px] p-3 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none leading-relaxed"
                />
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <MarkdownViewer content={fullDocItem.content || '*Empty note*'} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-400 dark:text-zinc-600">
            Select a note to read or edit
          </div>
        )}
      </div>
    </div>
  );
};
type CapsDocEditorProps = CapsuleDocEditorProps;
