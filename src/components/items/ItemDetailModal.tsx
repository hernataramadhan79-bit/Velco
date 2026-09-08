import React, { useState, useMemo, useEffect } from 'react';
import { Item, Tag, PriorityLevel, Attachment, FilePreviewContent } from '../../types/item';
import { Modal } from '../common/Modal';
import { ItemTagsEditor } from './ItemTagsEditor';
import { Badge } from '../common/Badge';
import {
  ExternalLink,
  Sparkles,
  MessageSquare,
  Tag as TagIcon,
  ListTodo,
  Bot,
  Trash2,
  Paperclip,
  Star,
  Archive,
  Loader2,
  ArrowLeft,
  RotateCcw,
  Download,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Info,
  FileText,
  Music,
  Video,
  Copy,
  Check,
  Calendar,
  HardDrive,
} from 'lucide-react';
import { useSettings } from '../../stores/settingsStore';
import { aiService } from '../../services/ai';
import { MarkdownViewer } from '../common/MarkdownViewer';
import { DueDatePicker } from '../tasks/DueDatePicker';
import { openExternalUrl } from '../../utils/urlUtils';
import { db } from '../../services/database';
import { useItemStore } from '../../stores/itemStore';
import { formatTaskBatchSource } from '../../types/item';
import {
  extractStructuredTasks,
  recommendCategorizedTags,
  smartHeuristicTaskExtraction,
  StructuredTaskItem,
  TagRecommendation,
} from '../../services/ai/taskExtractor';
import { TaskExtractionModal } from '../tasks/TaskExtractionModal';
import { TagRecommendationBar } from './TagRecommendationBar';
import { getProviderDisplayName } from '../../utils/aiUtils';
import {
  formatFileSize,
  getFileTypeMeta,
  getFileCategory,
  extractSizeFromContent,
} from '../../utils/fileUtils';
import { FileLightboxModal } from '../../features/files/FileLightboxModal';

async function fetchAttachmentPreview(attachmentId: string): Promise<FilePreviewContent | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const res = await invoke<any>('get_attachment_preview', { attachmentId });
    if (!res) return null;
    return {
      attachmentId: res.attachment_id,
      itemId: res.item_id,
      fileName: res.file_name,
      mimeType: res.mime_type,
      fileSize: res.file_size,
      dataUrl: res.data_url,
      textContent: res.text_content,
      previewType: res.preview_type,
      language: res.language,
      lineCount: res.line_count,
      charCount: res.char_count,
    };
  } catch (err) {
    console.warn('Failed to fetch attachment preview:', err);
    return null;
  }
}

const CsvPreviewTable: React.FC<{ content: string }> = ({ content }) => {
  const { headers, rows } = useMemo(() => {
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line: string) => {
      const res: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
          res.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      res.push(cur.trim());
      return res;
    };

    const h = parseLine(lines[0]);
    const r = lines.slice(1, 100).map(parseLine);
    return { headers: h, rows: r };
  }, [content]);

  if (headers.length === 0) {
    return <div className="text-slate-400 italic py-4 text-center">Empty CSV file</div>;
  }

  return (
    <div className="overflow-x-auto border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-2xs">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-white/[0.08] text-xs font-mono">
        <thead className="bg-slate-50 dark:bg-white/[0.04]">
          <tr>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider w-10">
              #
            </th>
            {headers.map((hdr, idx) => (
              <th
                key={idx}
                className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider"
              >
                {hdr}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-white/[0.05] bg-white dark:bg-[#101014]">
          {rows.map((row, rIdx) => (
            <tr
              key={rIdx}
              className={rIdx % 2 === 0 ? 'bg-transparent' : 'bg-slate-50/50 dark:bg-white/[0.02]'}
            >
              <td className="px-3 py-1.5 text-[10px] text-slate-400 dark:text-zinc-500 select-none">
                {rIdx + 1}
              </td>
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3 py-1.5 text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface ItemDetailModalProps {
  item: Item | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Item>) => Promise<any>;
  onTrash: (id: string) => void;
  onRestore?: (id: string) => void;
  onPermanentDelete?: (id: string) => void;
  allTags: Tag[];
  onCreateTag: (name: string) => Promise<Tag>;
}

interface ItemDetailContentProps {
  item: Item;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Item>) => Promise<any>;
  onTrash: (id: string) => void;
  onRestore?: (id: string) => void;
  onPermanentDelete?: (id: string) => void;
  allTags: Tag[];
  onCreateTag: (name: string) => Promise<Tag>;
}

const ItemDetailContent: React.FC<ItemDetailContentProps> = ({
  item,
  isOpen,
  onClose,
  onUpdate,
  onTrash,
  onRestore,
  onPermanentDelete,
  allTags,
  onCreateTag,
}) => {
  const { settings, updateSettings } = useSettings();
  const hasFiles =
    item.type === 'file' ||
    item.type === 'image' ||
    Boolean(item.attachments && item.attachments.length > 0);

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(() => {
    if (
      hasFiles &&
      item.content &&
      (/^File:\s*.+/i.test(item.content.trim()) ||
        item.content.trim() === item.title.trim() ||
        item.type === 'file')
    ) {
      return '';
    }
    return item.content || '';
  });
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeAiAction, setActiveAiAction] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'specs' | 'ai' | 'attachments'>('content');
  const [selectedAttachmentIdx, setSelectedAttachmentIdx] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [filePreview, setFilePreview] = useState<FilePreviewContent | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [copiedPreviewText, setCopiedPreviewText] = useState(false);
  const [textPreviewMode, setTextPreviewMode] = useState<'formatted' | 'raw'>('formatted');
  const notify = useItemStore((s) => s.notify);

  const activeAttachment: Attachment | undefined =
    item.attachments && item.attachments.length > 0
      ? item.attachments[Math.min(selectedAttachmentIdx, item.attachments.length - 1)]
      : undefined;

  useEffect(() => {
    let isMounted = true;
    if (!hasFiles) {
      setFilePreview(null);
      return;
    }

    const targetId = activeAttachment?.id || item.id;
    setLoadingPreview(true);
    fetchAttachmentPreview(targetId).then((res) => {
      if (isMounted) {
        setFilePreview(res);
        setLoadingPreview(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [hasFiles, activeAttachment?.id, item.id]);

  const handleCopyPreviewText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPreviewText(true);
    setTimeout(() => setCopiedPreviewText(false), 2000);
  };

  const activeFileName = activeAttachment?.fileName || item.title;
  const rawExt = (activeFileName.split('.').pop() || '').toLowerCase();
  const activeMeta = getFileTypeMeta(activeFileName, activeAttachment?.mimeType);

  const resolvedPreviewUrl =
    filePreview?.dataUrl && filePreview.dataUrl.trim() !== ''
      ? filePreview.dataUrl
      : activeAttachment?.dataUrl && activeAttachment.dataUrl.trim() !== ''
      ? activeAttachment.dataUrl
      : item.thumbnailUrl && item.thumbnailUrl.trim() !== ''
      ? item.thumbnailUrl
      : item.link?.previewImage && item.link.previewImage.trim() !== ''
      ? item.link.previewImage
      : null;
  const activePreviewUrl = resolvedPreviewUrl;

  const isImage =
    activeMeta.category === 'image' ||
    (activeAttachment &&
      (activeAttachment.mimeType.startsWith('image/') ||
        /\.(png|jpe?g|webp|gif|svg|bmp|ico|avif)$/i.test(activeAttachment.fileName))) ||
    item.type === 'image' ||
    filePreview?.previewType === 'image' ||
    ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico', 'avif'].includes(rawExt);

  const isPdf =
    activeMeta.extension === 'PDF' ||
    filePreview?.previewType === 'pdf' ||
    rawExt === 'pdf' ||
    Boolean(activeAttachment && activeAttachment.mimeType.includes('pdf'));

  const isVideo =
    activeMeta.category === 'media' &&
    ((activeAttachment && activeAttachment.mimeType.startsWith('video/')) ||
      ['mp4', 'webm', 'mov', 'mkv'].includes(rawExt));

  const isAudio =
    activeMeta.category === 'media' &&
    ((activeAttachment && activeAttachment.mimeType.startsWith('audio/')) ||
      ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(rawExt));

  const isMarkdown =
    filePreview?.previewType === 'markdown' ||
    ['md', 'markdown'].includes(rawExt);

  const isCsv =
    filePreview?.previewType === 'csv' ||
    ['csv', 'tsv'].includes(rawExt);

  const isDocx =
    filePreview?.previewType === 'docx' ||
    rawExt === 'docx';

  const isCode =
    filePreview?.previewType === 'code' ||
    ['js', 'jsx', 'ts', 'tsx', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'hpp', 'html', 'css', 'scss', 'xml', 'yaml', 'yml', 'toml', 'ini', 'env', 'sql', 'sh', 'bash', 'bat', 'ps1', 'json'].includes(rawExt);

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isPdf || !resolvedPreviewUrl) {
      setPdfBlobUrl(null);
      return;
    }

    if (resolvedPreviewUrl.startsWith('blob:') || resolvedPreviewUrl.startsWith('http')) {
      setPdfBlobUrl(resolvedPreviewUrl);
      return;
    }

    if (resolvedPreviewUrl.startsWith('data:application/pdf')) {
      try {
        const commaIdx = resolvedPreviewUrl.indexOf(',');
        const base64Str = commaIdx !== -1 ? resolvedPreviewUrl.slice(commaIdx + 1) : resolvedPreviewUrl;
        const binaryStr = atob(base64Str);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);

        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (err) {
        console.warn('Failed to convert base64 to PDF blob:', err);
        setPdfBlobUrl(null);
      }
    }
  }, [isPdf, resolvedPreviewUrl]);

  const handleOpenInSystemViewer = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const attachmentId = activeAttachment?.id || item.id;
      await invoke('open_attachment_in_os', { attachmentId });
      notify('Opening document in default application...', 'info');
    } catch (err) {
      console.error('Failed to open file in system viewer:', err);
      notify('Failed to open in default application: ' + String(err), 'error');
    }
  };

  const rawAttachmentText = useMemo(() => {
    if (filePreview?.textContent) return filePreview.textContent;
    if (activeAttachment?.dataUrl?.startsWith('data:text/')) {
      try {
        return decodeURIComponent(escape(atob(activeAttachment.dataUrl.split(',')[1] || '')));
      } catch {
        return null;
      }
    }
    return null;
  }, [filePreview?.textContent, activeAttachment?.dataUrl]);

  const isAutoFileContent = useMemo(() => {
    if (!hasFiles || !item.content) return false;
    const trimmed = item.content.trim();
    if (!trimmed) return true;

    // 1. Auto-generated file metadata header (e.g. "File: xxx\nSize: ...")
    if (/^File:\s*.+/i.test(trimmed)) return true;

    // 2. Exact match with file text content from preview or attachment
    if (rawAttachmentText && trimmed === rawAttachmentText.trim()) return true;
    if (filePreview?.textContent && trimmed === filePreview.textContent.trim()) return true;

    // 3. Exact match with active attachment filename or item title
    if (
      activeAttachment?.fileName &&
      (trimmed === activeAttachment.fileName.trim() ||
        trimmed === `File: ${activeAttachment.fileName.trim()}`)
    ) {
      return true;
    }
    if (trimmed === item.title.trim() && (trimmed.includes('.') || hasFiles)) {
      return true;
    }

    // 4. If rawAttachmentText is available and trimmed !== rawAttachmentText, this is user-created notes!
    if (rawAttachmentText && trimmed !== rawAttachmentText.trim()) {
      return false;
    }

    // 5. If file preview is still loading or rawAttachmentText is not loaded yet,
    // but the item is a file item whose content matches known file formats and not user notes
    if (
      item.type === 'file' &&
      (isCode || isMarkdown || isCsv || isDocx || rawExt) &&
      !trimmed.startsWith('# Notes')
    ) {
      return true;
    }

    return false;
  }, [
    hasFiles,
    item.content,
    item.title,
    item.type,
    rawAttachmentText,
    filePreview?.textContent,
    activeAttachment?.fileName,
    isCode,
    isMarkdown,
    isCsv,
    isDocx,
    rawExt,
  ]);

  const displayedNotes = hasFiles && isAutoFileContent ? '' : (item.content || '');

  const resolvedTextContent =
    rawAttachmentText ||
    (!hasFiles
      ? item.content
      : item.content && item.content.trim() && !item.content.startsWith('File: ')
      ? item.content
      : null);

  // Synchronize content state when displayedNotes changes and not editing
  useEffect(() => {
    if (!isEditing) {
      setContent(displayedNotes);
    }
  }, [displayedNotes, isEditing]);

  const isTextLike =
    !isImage &&
    !isVideo &&
    !isAudio &&
    !isPdf &&
    (filePreview?.previewType === 'text' ||
      filePreview?.previewType === 'code' ||
      filePreview?.previewType === 'markdown' ||
      filePreview?.previewType === 'csv' ||
      filePreview?.previewType === 'docx' ||
      filePreview?.previewType === 'xlsx' ||
      Boolean(resolvedTextContent) ||
      isMarkdown ||
      isCsv ||
      isDocx ||
      isCode ||
      activeMeta.category === 'document' ||
      activeMeta.category === 'code' ||
      ['txt', 'log', 'diff', 'patch', 'conf', 'properties'].includes(rawExt));

  const lightboxItem = useMemo(
    () => ({
      id: item.id,
      type: item.type,
      title: activeAttachment?.fileName || item.title,
      excerpt: displayedNotes || item.content,
      pinned: item.favorite,
      archived: item.archived,
      trashed: !!item.deletedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      tags: item.tags,
      thumbnailUrl: resolvedPreviewUrl,
    }),
    [item, activeAttachment, displayedNotes, resolvedPreviewUrl]
  );

  const handleDownloadAttachment = (att?: Attachment) => {
    const target = att || activeAttachment;
    const url = target?.dataUrl || item.thumbnailUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = target?.fileName || item.title || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const [chatMessages, setChatMessages] = useState<
    { role: 'user' | 'assistant'; content: string; time: string }[]
  >([]);
  const [chatInput, setChatInput] = useState('');

  // Structured AI Actions State
  const [extractedTasks, setExtractedTasks] = useState<StructuredTaskItem[]>([]);
  const [isExtractionModalOpen, setIsExtractionModalOpen] = useState(false);
  const [tagRecommendations, setTagRecommendations] = useState<TagRecommendation[]>([]);
  const [isTagRecOpen, setIsTagRecOpen] = useState(false);

  const handleConfirmExtractedTasks = async (tasksToCreate: StructuredTaskItem[]) => {
    const batchId = crypto.randomUUID();
    const batchMeta = formatTaskBatchSource({
      origin: 'ai_extract',
      batchId,
      batchTitle: item.title || 'Extracted Tasks',
      sourceItemId: item.id,
      generatedAt: new Date().toISOString(),
    });

    for (const task of tasksToCreate) {
      await db.createItem({
        type: 'task',
        title: task.title,
        content: task.description || '',
        source: batchMeta,
        task: {
          priority: task.priority,
          dueDate: task.dueDate || null,
          completed: false,
        },
      });
    }

    await useItemStore.getState().refreshItems();
    await useItemStore.getState().refreshCounts();
    notify(`Created ${tasksToCreate.length} tasks from this item!`, 'success');
  };

  const handleApplyRecommendedTags = async (chosen: TagRecommendation[]) => {
    let currentTags = [...item.tags];
    for (const rec of chosen) {
      let tagObj: Tag | undefined;
      if (rec.existingTagId) {
        tagObj = allTags.find((t) => t.id === rec.existingTagId);
      }
      if (!tagObj) {
        tagObj = await onCreateTag(rec.name);
      }
      if (tagObj && !currentTags.some((t) => t.id === tagObj!.id)) {
        currentTags.push(tagObj);
      }
    }
    await onUpdate(item.id, { tags: currentTags });
    setIsTagRecOpen(false);
    notify(`Attached ${chosen.length} tags to item!`, 'success');
  };

  const getAiConfig = () => {
    const providerInfo = getProviderDisplayName(settings);
    let baseUrl: string | undefined;
    let apiKey: string | undefined;
    let model = providerInfo.modelName;

    switch (settings.aiProvider) {
      case 'ollama':
        baseUrl = settings.ollamaUrl || 'http://localhost:11434';
        model = settings.ollamaModel || 'qwen2.5:latest';
        break;
      case 'lmstudio':
        baseUrl = settings.lmstudioUrl || 'http://localhost:1234/v1';
        model = settings.lmstudioModel || 'qwen2.5-coder-7b-instruct';
        break;
      case 'openai':
        baseUrl = 'https://api.openai.com/v1';
        apiKey = settings.openaiApiKey;
        model = settings.openaiModel || 'gpt-4o-mini';
        break;
      case 'gemini':
        baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
        apiKey = settings.geminiApiKey;
        model = settings.geminiModel || 'gemini-1.5-flash';
        break;
      case 'anthropic':
        baseUrl = 'https://api.anthropic.com/v1';
        apiKey = settings.anthropicApiKey;
        model = settings.anthropicModel || 'claude-3-5-haiku-20241022';
        break;
      case 'openrouter':
        baseUrl = 'https://openrouter.ai/api/v1';
        apiKey = settings.openrouterApiKey;
        model = settings.openrouterModel || 'meta-llama/llama-3.3-70b-instruct:free';
        break;
      case 'custom':
        baseUrl = settings.customApiUrl;
        apiKey = settings.customApiKey;
        model = settings.customModel || 'default';
        break;
      default:
        break;
    }

    return {
      name: providerInfo.providerName,
      baseUrl,
      apiKey,
      model,
      isLocal: providerInfo.isLocal,
    };
  };

  // AI Actions implementation
  const runAiAction = async (
    action: 'summarize' | 'classify' | 'tags' | 'explain' | 'extract_tasks'
  ) => {
    if (!settings.aiEnabled || settings.aiProvider === 'none') {
      setAiError('AI is currently disabled in settings.');
      return;
    }
    const textToProcess = hasFiles
      ? [
          item.title,
          displayedNotes ? `Notes:\n${displayedNotes}` : '',
          resolvedTextContent
            ? `File Preview:\n${resolvedTextContent.length > 3000 ? resolvedTextContent.slice(0, 3000) + '...' : resolvedTextContent}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n')
      : `${item.title}\n\n${item.content}`;
    if (!textToProcess.trim()) {
      setAiError('Item has no content to process.');
      return;
    }

    const active = getAiConfig();

    setIsAiLoading(true);
    setActiveAiAction(action);
    setAiError(null);

    try {
      const isOnline = await aiService.checkStatus(active.baseUrl, active.apiKey);
      if (!isOnline) {
        // If extracting tasks while AI is unreachable, gracefully fallback to smart heuristics
        if (action === 'extract_tasks') {
          const structuredTasks = smartHeuristicTaskExtraction(textToProcess);
          setExtractedTasks(structuredTasks);
          setIsExtractionModalOpen(true);
          return;
        }
        throw new Error(
          active.isLocal
            ? `AI provider (${active.name}) is unreachable at ${active.baseUrl || 'local endpoint'}. Make sure your local server (e.g. Ollama) is running.`
            : `Cloud AI provider (${active.name}) is not connected. Please verify your API key in Settings.`
        );
      }

      if (action === 'summarize') {
        const summary = await aiService.generateCompletion(
          `Please provide a concise, well-structured summary of the following content:\n\n${textToProcess}`,
          active.model,
          active.baseUrl,
          active.apiKey
        );
        await onUpdate(item.id, {
          aiMetadata: {
            id: crypto.randomUUID(),
            itemId: item.id,
            provider: active.name,
            model: active.model,
            summary: summary.trim(),
            processedAt: new Date().toISOString(),
          },
        });
        setActiveTab('ai');
      } else if (action === 'classify') {
        const raw = await aiService.generateCompletion(
          `Analyze the following content and categorize it. Return ONLY valid JSON with keys "category" (e.g. Work, Personal, Reference, Ideas), "confidence" (number 0.0 to 1.0), and "suggestedTags" (array of strings):\n\n${textToProcess}`,
          active.model,
          active.baseUrl,
          active.apiKey
        );
        let parsed = { category: 'General', confidence: 0.8, suggestedTags: [] as string[] };
        try {
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        } catch { /* use fallback */ }
        await onUpdate(item.id, {
          aiMetadata: {
            id: crypto.randomUUID(),
            itemId: item.id,
            provider: active.name,
            model: active.model,
            classification: parsed.category,
            confidence: parsed.confidence,
            suggestedTags: parsed.suggestedTags,
            processedAt: new Date().toISOString(),
          },
        });
        setActiveTab('ai');
      } else if (action === 'tags') {
        const recommendations = await recommendCategorizedTags(
          textToProcess,
          allTags,
          active.model,
          active.baseUrl,
          active.apiKey
        );
        setTagRecommendations(recommendations);
        setIsTagRecOpen(true);
      } else if (action === 'explain') {
        const answer = await aiService.generateCompletion(
          `Explain what this item is about and its main takeaways in clear terms:\n\n${textToProcess}`,
          active.model,
          active.baseUrl,
          active.apiKey
        );
        setChatMessages((prev) => [
          ...prev,
          { role: 'user', content: 'Explain this item', time: new Date().toLocaleTimeString() },
          { role: 'assistant', content: answer.trim(), time: new Date().toLocaleTimeString() },
        ]);
        setActiveTab('ai');
      } else if (action === 'extract_tasks') {
        const structuredTasks = await extractStructuredTasks(
          textToProcess,
          active.model,
          active.baseUrl,
          active.apiKey
        );
        setExtractedTasks(structuredTasks);
        setIsExtractionModalOpen(true);
      }
    } catch (err: any) {
      setAiError(err.message || 'AI operation failed');
    } finally {
      setIsAiLoading(false);
      setActiveAiAction(null);
    }
  };

  const handleSendChat = async () => {
    if (!settings.aiEnabled || settings.aiProvider === 'none') {
      setAiError('AI is currently disabled in settings.');
      return;
    }
    if (!chatInput.trim() || isAiLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [
      ...prev,
      { role: 'user', content: userMsg, time: new Date().toLocaleTimeString() },
    ]);

    setIsAiLoading(true);
    setActiveAiAction('chat');
    setAiError(null);
    try {
      const active = getAiConfig();
      const isOnline = await aiService.checkStatus(active.baseUrl, active.apiKey);
      if (!isOnline) {
        throw new Error(
          active.isLocal
            ? `AI provider (${active.name}) is unreachable at ${active.baseUrl || 'local endpoint'}.`
            : `Cloud AI provider (${active.name}) is not connected. Please verify your API key in Settings.`
        );
      }

      const itemContext = hasFiles
        ? [
            item.title,
            displayedNotes ? `Notes:\n${displayedNotes}` : '',
            resolvedTextContent
              ? `File Preview:\n${resolvedTextContent.length > 2000 ? resolvedTextContent.slice(0, 2000) + '...' : resolvedTextContent}`
              : '',
          ]
            .filter(Boolean)
            .join('\n\n')
        : `${item.title}\n\n${item.content}`;

      const prompt = `Context:\n${itemContext}\n\n${chatMessages
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n')}\nuser: ${userMsg}\nassistant:`;

      const answer = await aiService.generateCompletion(
        prompt,
        active.model,
        active.baseUrl,
        active.apiKey
      );

      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: answer.trim(), time: new Date().toLocaleTimeString() },
      ]);
    } catch (err: any) {
      setAiError(err.message || 'Chat request failed');
    } finally {
      setIsAiLoading(false);
      setActiveAiAction(null);
    }
  };

  const handleSaveEdit = async () => {
    const trimmedTitle = title.trim() || 'Untitled';
    const updates: Partial<Item> = {
      title: trimmedTitle,
    };
    if (!hasFiles || !isAutoFileContent || content.trim() !== '') {
      updates.content = content.trim();
    }
    await onUpdate(item.id, updates);
    setIsEditing(false);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        maxWidth="4xl"
        bodyClassName="p-5 sm:p-7 space-y-5"
      >
        {/* ── Top Header & Actions Bar ── */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-white/[0.08]">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-200 dark:border-white/[0.08] transition-colors cursor-pointer shadow-2xs"
              title="Back to workspace (Esc)"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
              <kbd className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-slate-200 dark:bg-white/[0.08] text-slate-500 dark:text-zinc-400 font-mono">
                Esc
              </kbd>
            </button>

            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide uppercase border ${
                  hasFiles
                    ? `${activeMeta.badgeBg} ${activeMeta.badgeText} ${activeMeta.badgeBorder}`
                    : 'bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/[0.08]'
                }`}
              >
                {hasFiles ? activeMeta.extension : item.type}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono hidden sm:inline-block">
                Created{' '}
                {new Date(item.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {hasFiles && activePreviewUrl && (
              <button
                type="button"
                onClick={() => handleDownloadAttachment()}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/[0.08] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>
            )}

            {item.deletedAt ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (onRestore) onRestore(item.id);
                    onClose();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Restore to Inbox"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Delete this item permanently? This action cannot be undone.')) {
                      if (onPermanentDelete) onPermanentDelete(item.id);
                      onClose();
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Delete Permanently"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Permanently</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onUpdate(item.id, { favorite: !item.favorite })}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                    item.favorite
                      ? 'border-amber-300 bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:border-amber-700'
                      : 'border-slate-200 dark:border-white/[0.08] text-slate-400 hover:text-amber-500'
                  }`}
                  title="Favorite"
                >
                  <Star className={`w-4 h-4 ${item.favorite ? 'fill-current' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate(item.id, { archived: !item.archived })}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                    item.archived
                      ? 'border-blue-300 bg-blue-50 text-blue-600 dark:bg-blue-950/40'
                      : 'border-slate-200 dark:border-white/[0.08] text-slate-400 hover:text-blue-500'
                  }`}
                  title="Archive"
                >
                  <Archive className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onTrash(item.id);
                    onClose();
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                  title="Trash"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── File Preview Hero Stage (Shown prominently when item is or has files) ── */}
        {hasFiles && (
          <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/[0.1] bg-slate-900/[0.03] dark:bg-black/40 shadow-xs">
            {/* Stage Toolbar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-white/[0.08] bg-white/80 dark:bg-[#141418]/80 backdrop-blur-md">
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
                    onClick={() => setIsZoomed((z) => !z)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                    title={isZoomed ? 'Fit to frame' : 'Zoom 100%'}
                  >
                    {isZoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
                  </button>
                )}

                {isImage && (
                  <button
                    type="button"
                    onClick={() => setIsLightboxOpen(true)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                    title="Fullscreen Lightbox"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {resolvedPreviewUrl && (
                  <button
                    type="button"
                    onClick={() => handleDownloadAttachment()}
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
                  onClick={() => setIsLightboxOpen(true)}
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
                        onClick={handleOpenInSystemViewer}
                        className="px-2.5 py-1 rounded text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Open PDF in system default viewer (Adobe Acrobat, Edge, Chrome, etc.)"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open in Default App</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadAttachment()}
                        className="px-2.5 py-1 rounded text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
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
                        Open the document directly in your system's default PDF viewer for the best reading experience and full interactive features.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleOpenInSystemViewer}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Open in Default App</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadAttachment()}
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
                  <audio src={resolvedPreviewUrl} controls className="w-full" />
                </div>
              ) : isTextLike && resolvedTextContent ? (
                /* Rich Text / Code / Markdown / CSV / Docx Content Stage */
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
                            onClick={() => setTextPreviewMode('formatted')}
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
                            onClick={() => setTextPreviewMode('raw')}
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
                        onClick={() => handleCopyPreviewText(resolvedTextContent)}
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
                          onClick={() => handleDownloadAttachment()}
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
                      /* Code / Plain Text Viewer with Line Numbers */
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
                /* Fallback Document Card */
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
                      onClick={handleOpenInSystemViewer}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in Default App</span>
                    </button>
                    {resolvedPreviewUrl && (
                      <button
                        type="button"
                        onClick={() => handleDownloadAttachment()}
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
            {item.attachments && item.attachments.length > 1 && (
              <div className="flex items-center gap-2 p-2.5 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#101014]/70 overflow-x-auto">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 shrink-0">
                  Files ({item.attachments.length}):
                </span>
                {item.attachments.map((att, idx) => {
                  const isImg =
                    att.mimeType.startsWith('image/') ||
                    att.fileName.match(/\.(png|jpe?g|webp|gif|svg)$/i);
                  const isSelected = selectedAttachmentIdx === idx;
                  return (
                    <button
                      key={att.id || idx}
                      type="button"
                      onClick={() => {
                        setSelectedAttachmentIdx(idx);
                        setIsZoomed(false);
                      }}
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
        )}

        {/* ── Title Bar ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-base font-bold rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-300 dark:border-white/[0.1] text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            ) : (
              <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100 tracking-tight leading-snug break-words">
                {item.title}
              </h2>
            )}
          </div>

          <button
            onClick={() => (isEditing ? handleSaveEdit() : setIsEditing(true))}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/[0.08] transition-colors cursor-pointer shrink-0"
          >
            {isEditing ? 'Done' : 'Edit Title'}
          </button>
        </div>

        {/* ── Task Settings Bar (Clean, uncluttered single-row editor if task) ── */}
        {item.type === 'task' && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 font-semibold cursor-pointer text-slate-800 dark:text-zinc-200 text-xs">
              <input
                type="checkbox"
                checked={item.task?.completed || false}
                onChange={(e) =>
                  onUpdate(item.id, {
                    task: {
                      ...(item.task || { priority: 'medium' }),
                      completed: e.target.checked,
                      completedAt: e.target.checked ? new Date().toISOString() : null,
                    },
                  })
                }
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-zinc-700 bg-white dark:bg-[#141418]"
              />
              <span className={item.task?.completed ? 'line-through text-slate-400 dark:text-zinc-500' : ''}>
                {item.task?.completed ? 'Task Completed' : 'Pending Task'}
              </span>
            </label>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 dark:text-zinc-500 text-[11px]">Priority:</span>
                {(['low', 'medium', 'high', 'urgent'] as PriorityLevel[]).map((p) => {
                  const active = (item.task?.priority || 'medium') === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        onUpdate(item.id, {
                          task: {
                            ...(item.task || { completed: false }),
                            priority: p,
                          },
                        })
                      }
                      className={`px-2 py-0.5 rounded-md capitalize text-[11px] font-medium transition-colors cursor-pointer ${
                        active
                          ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                          : 'bg-slate-200/70 hover:bg-slate-300/70 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <DueDatePicker
                taskId={item.id}
                value={item.task?.dueDate || ''}
                onChange={(newDueDate) =>
                  onUpdate(item.id, {
                    task: {
                      ...(item.task || { priority: 'medium', completed: false }),
                      dueDate: newDueDate || null,
                    },
                  })
                }
              />
            </div>
          </div>
        )}

        {/* ── Link Preview Row (if link) ── */}
        {item.type === 'link' && item.link && (
          <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-blue-900 dark:text-blue-200 truncate">
                {item.link.pageTitle || item.link.url}
              </div>
              <div className="text-[11px] text-blue-600 dark:text-blue-400 font-mono truncate">
                {item.link.url}
              </div>
            </div>
            <button
              type="button"
              onClick={() => openExternalUrl(item.link!.url)}
              className="ml-3 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
            >
              <span>Open in Browser</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ── AI Tag Recommendations Bar ── */}
        {isTagRecOpen && tagRecommendations.length > 0 && (
          <TagRecommendationBar
            recommendations={tagRecommendations}
            onApply={handleApplyRecommendedTags}
            onDismiss={() => setIsTagRecOpen(false)}
          />
        )}

        {/* ── Tags Editor Bar ── */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <ItemTagsEditor
            itemTags={item.tags || []}
            allTags={allTags}
            onAddTag={(tagId) => {
              const tag = allTags.find((t) => t.id === tagId);
              if (tag && !item.tags.some((t) => t.id === tagId)) {
                onUpdate(item.id, { tags: [...item.tags, tag] });
              }
            }}
            onRemoveTag={(tagId) => {
              onUpdate(item.id, { tags: item.tags.filter((t) => t.id !== tagId) });
            }}
            onCreateTag={onCreateTag}
          />
          {settings.aiEnabled && !isTagRecOpen && (
            <button
              type="button"
              onClick={() => runAiAction('tags')}
              disabled={isAiLoading}
              className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 py-1 px-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
            >
              <Sparkles className="w-3 h-3" />
              <span>AI Suggest Tags</span>
            </button>
          )}
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-white/[0.08] pt-2 text-xs">
          <button
            onClick={() => setActiveTab('content')}
            className={`pb-2.5 px-1 font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'content'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200'
            }`}
          >
            {hasFiles ? 'Notes & Description' : 'Content & Notes'}
          </button>
          {hasFiles && (
            <button
              onClick={() => setActiveTab('specs')}
              className={`pb-2.5 px-1 font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'specs'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>File Details</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('ai')}
            className={`pb-2.5 px-1 font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'ai'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Assistant & Chat</span>
            {item.aiMetadata?.summary && (
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            )}
          </button>
          {item.attachments && item.attachments.length > 1 && (
            <button
              onClick={() => setActiveTab('attachments')}
              className={`pb-2.5 px-1 font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'attachments'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              All Attachments ({item.attachments.length})
            </button>
          )}
        </div>

        {/* ── Tab 1: Content & Notes ── */}
        {activeTab === 'content' && (
          <div className="space-y-4">
            {isEditing ? (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={7}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-300 dark:border-white/[0.08] text-sm text-slate-900 dark:text-zinc-100 font-sans leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={
                  hasFiles
                    ? 'Add custom notes, context, or description for this file...'
                    : 'Markdown notes or description...'
                }
                autoFocus
              />
            ) : displayedNotes ? (
              <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-[#101014]/60 border border-slate-200/80 dark:border-white/[0.06] min-h-[70px] text-sm text-slate-800 dark:text-zinc-200 leading-relaxed">
                <MarkdownViewer content={displayedNotes} />
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-white/[0.08] text-center bg-slate-50/30 dark:bg-white/[0.02]">
                <p className="text-xs text-slate-400 dark:text-zinc-500 mb-2">
                  No additional notes or description yet.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setContent('');
                    setIsEditing(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Add Notes
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                {displayedNotes ? `${displayedNotes.split(/\s+/).filter(Boolean).length} words` : '0 words'}
              </div>

              {isEditing ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTitle(item.title);
                      setContent(displayedNotes);
                      setIsEditing(false);
                    }}
                    className="px-3 py-1.5 text-xs rounded-lg text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-white/[0.06] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-xs cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {settings.aiEnabled && displayedNotes.trim() && item.type !== 'task' && (
                    <button
                      type="button"
                      onClick={() => runAiAction('extract_tasks')}
                      disabled={isAiLoading}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      title="Extract discrete tasks from this note using AI"
                    >
                      <ListTodo className="w-3.5 h-3.5" />
                      <span>Extract Tasks</span>
                    </button>
                  )}
                  {displayedNotes && (
                    <button
                      type="button"
                      onClick={() => {
                        setContent(displayedNotes);
                        setIsEditing(true);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/[0.08] transition-colors cursor-pointer"
                    >
                      Edit Notes
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab 2: File Specs & Details (Shown when file item) ── */}
        {activeTab === 'specs' && hasFiles && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-zinc-500">File Name</span>
                <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 break-all">
                  {activeFileName}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-zinc-500">Extension & Category</span>
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
                  onClick={() => handleDownloadAttachment()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download {activeFileName}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: AI Actions & Context Q&A */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            {!settings.aiEnabled ? (
              <div className="p-6 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.07] text-center space-y-3">
                <div className="w-10 h-10 mx-auto rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Local AI is Disabled
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    Turn on Local AI to generate summaries, auto-classify notes, and ask questions offline.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateSettings({ aiEnabled: true })}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                >
                  Enable Local AI
                </button>
              </div>
            ) : (
              <>
                {/* AI Action Buttons */}
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Actions ({getProviderDisplayName(settings).providerName})
                  </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => runAiAction('summarize')}
                  disabled={isAiLoading}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/[0.08] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAiLoading && activeAiAction === 'summarize' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{isAiLoading && activeAiAction === 'summarize' ? 'Processing...' : 'Summarize'}</span>
                </button>
                <button
                  onClick={() => runAiAction('classify')}
                  disabled={isAiLoading}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/[0.08] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAiLoading && activeAiAction === 'classify' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                  ) : (
                    <Bot className="w-3.5 h-3.5" />
                  )}
                  <span>{isAiLoading && activeAiAction === 'classify' ? 'Processing...' : 'Classify'}</span>
                </button>
                <button
                  onClick={() => runAiAction('tags')}
                  disabled={isAiLoading}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/[0.08] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAiLoading && activeAiAction === 'tags' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                  ) : (
                    <TagIcon className="w-3.5 h-3.5" />
                  )}
                  <span>{isAiLoading && activeAiAction === 'tags' ? 'Processing...' : 'Suggest Tags'}</span>
                </button>
                <button
                  onClick={() => runAiAction('extract_tasks')}
                  disabled={isAiLoading}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/[0.08] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAiLoading && activeAiAction === 'extract_tasks' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                  ) : (
                    <ListTodo className="w-3.5 h-3.5" />
                  )}
                  <span>{isAiLoading && activeAiAction === 'extract_tasks' ? 'Processing...' : 'Extract Tasks'}</span>
                </button>
                <button
                  onClick={() => runAiAction('explain')}
                  disabled={isAiLoading}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/[0.08] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAiLoading && activeAiAction === 'explain' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  ) : (
                    <MessageSquare className="w-3.5 h-3.5" />
                  )}
                  <span>{isAiLoading && activeAiAction === 'explain' ? 'Processing...' : 'Explain'}</span>
                </button>
              </div>
            </div>

            {/* Minimal inline processing status */}
            {isAiLoading && activeAiAction !== 'chat' && (
              <div className="flex items-center gap-2 py-1 px-2.5 rounded-md bg-slate-50 dark:bg-[#101014] border border-slate-200/70 dark:border-white/[0.07] text-xs text-slate-500 dark:text-zinc-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />
                <span>Processing AI request...</span>
              </div>
            )}

            {/* Error banner */}
            {aiError && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-800 dark:text-amber-200">
                {aiError}
              </div>
            )}

            {/* AI Summary View */}
            {item.aiMetadata?.summary && (
              <div className="p-3.5 rounded-xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/40 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-blue-700 dark:text-blue-300">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Summary ({item.aiMetadata.model})</span>
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                    {new Date(item.aiMetadata.processedAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
                  {item.aiMetadata.summary}
                </p>
                {item.aiMetadata.classification && (
                  <div className="pt-1 text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                    Category: <span className="font-semibold text-slate-700 dark:text-zinc-300">{item.aiMetadata.classification}</span>
                  </div>
                )}
              </div>
            )}

            {/* Context-bound AI Chat */}
            <div className="border border-slate-200 dark:border-white/[0.07] rounded-xl overflow-hidden bg-slate-50/40 dark:bg-[#101014]">
              <div className="p-2.5 bg-slate-100 dark:bg-[#141418] text-xs font-semibold text-slate-700 dark:text-zinc-300 border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between">
                <span>Ask About This Item</span>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-normal">
                  Context bounded to this note
                </span>
              </div>

              <div className="p-3 max-h-48 overflow-y-auto space-y-2 text-xs custom-scrollbar">
                {chatMessages.length === 0 ? (
                  <div className="text-slate-400 dark:text-zinc-500 text-center py-4 text-[11px]">
                    Ask any question about this item's content.
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded-lg leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-950 dark:text-blue-100 ml-6'
                          : 'bg-white dark:bg-[#141418] text-slate-800 dark:text-zinc-200 mr-6 border border-slate-200/80 dark:border-white/[0.07]'
                      }`}
                    >
                      <div className="font-semibold text-[10px] mb-0.5 opacity-70">
                        {msg.role === 'user' ? 'You' : 'Assistant'}
                      </div>
                      <div>{msg.content}</div>
                    </div>
                  ))
                )}

                {/* Minimal typing indicator for chat */}
                {isAiLoading && activeAiAction === 'chat' && (
                  <div className="flex items-center gap-2 py-1 px-2.5 rounded-md bg-slate-50 dark:bg-[#141418] text-xs text-slate-500 border border-slate-200/60 dark:border-white/[0.07] w-fit">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-500 shrink-0" />
                    <span>Typing response...</span>
                  </div>
                )}
              </div>

              <div className="p-2 border-t border-slate-200 dark:border-white/[0.06] flex items-center gap-1.5 bg-white dark:bg-[#101014]">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendChat();
                  }}
                  placeholder="Ask a question..."
                  disabled={isAiLoading}
                  className="flex-1 px-3 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleSendChat}
                  disabled={isAiLoading || !chatInput.trim()}
                  className="px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold disabled:opacity-40 cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  {isAiLoading && activeAiAction === 'chat' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : null}
                  <span>{isAiLoading && activeAiAction === 'chat' ? 'Thinking...' : 'Ask'}</span>
                </button>
              </div>
            </div>
              </>
            )}
          </div>
        )}

        {/* Tab 3: Attachments */}
        {activeTab === 'attachments' && item.attachments && (
          <div className="space-y-2">
            {item.attachments.map((att) => (
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
        )}
      </Modal>

      {/* Structured Task Extraction Review Dialog */}
      <TaskExtractionModal
        isOpen={isExtractionModalOpen}
        onClose={() => setIsExtractionModalOpen(false)}
        tasks={extractedTasks}
        sourceTitle={item.title}
        onConfirm={handleConfirmExtractedTasks}
      />

      {/* Lightbox Viewer */}
      {isLightboxOpen && (
        <FileLightboxModal
          isOpen={isLightboxOpen}
          item={lightboxItem}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}
    </>
  );
};

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  onUpdate,
  onTrash,
  onRestore,
  onPermanentDelete,
  allTags,
  onCreateTag,
}) => {
  if (!isOpen || !item) return null;

  return (
    <ItemDetailContent
      key={item.id}
      item={item}
      isOpen={isOpen}
      onClose={onClose}
      onUpdate={onUpdate}
      onTrash={onTrash}
      onRestore={onRestore}
      onPermanentDelete={onPermanentDelete}
      allTags={allTags}
      onCreateTag={onCreateTag}
    />
  );
};
