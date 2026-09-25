import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileDown, FileJson, FileText, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface ExportFormat {
  id: 'json' | 'markdown' | 'csv';
  label: string;
  description: string;
  ext: string;
  mimeType: string;
  icon: React.ElementType;
}

const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: 'json',
    label: 'JSON',
    description: 'Full structured export. All fields, tags, task metadata — machine-readable.',
    ext: 'json',
    mimeType: 'application/json',
    icon: FileJson,
  },
  {
    id: 'markdown',
    label: 'Markdown',
    description: 'Human-readable export. Each item becomes a Markdown document with YAML frontmatter.',
    ext: 'md',
    mimeType: 'text/markdown',
    icon: FileText,
  },
  {
    id: 'csv',
    label: 'CSV',
    description: 'Spreadsheet-compatible export. Title, type, content, tags, dates — one row per item.',
    ext: 'csv',
    mimeType: 'text/csv',
    icon: FileDown,
  },
];

/** Convert items JSON to Markdown format */
function itemsToMarkdown(items: any[]): string {
  const lines: string[] = [
    '# Velco Export',
    '',
    `> Exported: ${new Date().toISOString()}`,
    `> Total items: ${items.length}`,
    '',
    '---',
    '',
  ];

  for (const item of items) {
    lines.push(`## ${item.title || 'Untitled'}`);
    lines.push('');

    // YAML frontmatter block
    lines.push('```yaml');
    lines.push(`id: ${item.id}`);
    lines.push(`type: ${item.type}`);
    lines.push(`created: ${item.created_at || item.createdAt || ''}`);
    lines.push(`updated: ${item.updated_at || item.updatedAt || ''}`);
    if (item.tags?.length) {
      lines.push(`tags: [${item.tags.map((t: any) => t.name).join(', ')}]`);
    }
    if (item.task) {
      lines.push(`priority: ${item.task.priority || 'medium'}`);
      lines.push(`completed: ${item.task.completed ? 'true' : 'false'}`);
      if (item.task.due_date || item.task.dueDate) {
        lines.push(`due: ${item.task.due_date || item.task.dueDate}`);
      }
    }
    if (item.link) {
      lines.push(`url: ${item.link.url}`);
    }
    lines.push('```');
    lines.push('');

    if (item.content && String(item.content).trim()) {
      lines.push(String(item.content).trim());
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/** Convert items JSON to CSV format */
function itemsToCsv(items: any[]): string {
  const headers = ['id', 'type', 'title', 'content_preview', 'tags', 'priority', 'completed', 'due_date', 'url', 'created_at', 'updated_at'];
  const escape = (v: any) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = items.map(item => [
    item.id,
    item.type,
    item.title || '',
    String(item.content || '').slice(0, 200).replace(/\n/g, ' '),
    (item.tags || []).map((t: any) => t.name).join('; '),
    item.task?.priority || '',
    item.task?.completed ? 'true' : '',
    item.task?.due_date || item.task?.dueDate || '',
    item.link?.url || '',
    item.created_at || item.createdAt || '',
    item.updated_at || item.updatedAt || '',
  ].map(escape).join(','));

  return [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
}

export const DataExportPanel: React.FC = () => {
  const [selectedFormat, setSelectedFormat] = useState<'json' | 'markdown' | 'csv'>('json');
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setMessage(null);
    let url: string | null = null;

    try {
      // Fetch all items via backend
      const rawItems = await invoke<any[]>('get_items_summary', {
        filterType: null,
        includeTrash: false,
        includeArchived: true,
      });

      const format = EXPORT_FORMATS.find(f => f.id === selectedFormat)!;
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `velco_export_${dateStr}.${format.ext}`;

      let content: string;
      if (selectedFormat === 'json') {
        content = JSON.stringify(rawItems, null, 2);
      } else if (selectedFormat === 'markdown') {
        content = itemsToMarkdown(rawItems);
      } else {
        content = itemsToCsv(rawItems);
      }

      const blob = new Blob([content], { type: format.mimeType });
      url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setMessage({ text: `Exported ${rawItems.length} items as ${format.label}`, type: 'success' });
      setTimeout(() => setMessage(null), 5000);
    } catch (err: any) {
      setMessage({ text: `Export failed: ${err.message ?? err}`, type: 'error' });
    } finally {
      setIsExporting(false);
      if (url) setTimeout(() => URL.revokeObjectURL(url as string), 5000);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <FileDown className="w-3.5 h-3.5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Export Your Data</h3>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
            Your data, your format. No lock-in.
          </p>
        </div>
      </div>

      {/* Format selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {EXPORT_FORMATS.map((fmt) => {
          const Icon = fmt.icon;
          const isActive = selectedFormat === fmt.id;
          return (
            <button
              key={fmt.id}
              type="button"
              onClick={() => setSelectedFormat(fmt.id)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                isActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 ring-1 ring-blue-500/30'
                  : 'border-slate-200 dark:border-white/[0.07] hover:border-slate-300 dark:hover:border-white/[0.12] bg-white dark:bg-[#101014]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-zinc-500'}`} />
                <span className={`text-xs font-semibold ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-zinc-300'}`}>
                  {fmt.label}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                {fmt.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Export button */}
      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all cursor-pointer active:scale-[0.98]"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Exporting...</span>
          </>
        ) : (
          <>
            <FileDown className="w-3.5 h-3.5" />
            <span>Export as {EXPORT_FORMATS.find(f => f.id === selectedFormat)?.label}</span>
          </>
        )}
      </button>

      {/* Status message */}
      {message && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
          message.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
            : 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
        }`}>
          {message.type === 'success'
            ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          }
          {message.text}
        </div>
      )}
    </div>
  );
};
