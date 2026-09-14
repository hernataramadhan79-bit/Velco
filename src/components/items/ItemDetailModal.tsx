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
import { formatDisplayDate } from '../../utils/dateUtils';
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
import { invoke } from '@tauri-apps/api/core';
import { z } from 'zod';
import { TaskExtractionModal } from '../tasks/TaskExtractionModal';
import { TagRecommendationBar } from './TagRecommendationBar';
import { getProviderDisplayName, extractValidJson } from '../../utils/aiUtils';
import {
  formatFileSize,
  getFileTypeMeta,
  getFileCategory,
  extractSizeFromContent,
} from '../../utils/fileUtils';
import { FileLightboxModal } from '../../features/files/FileLightboxModal';
import { ItemDetailHeader } from './detail/ItemDetailHeader';
import { FilePreviewStage } from './detail/FilePreviewStage';
import { ItemDetailMetaBar } from './detail/ItemDetailMetaBar';
import { ItemDetailContentTab } from './detail/ItemDetailContentTab';
import { ItemDetailSpecsTab } from './detail/ItemDetailSpecsTab';
import { ItemDetailAiTab } from './detail/ItemDetailAiTab';
import { ItemDetailAttachmentsTab } from './detail/ItemDetailAttachmentsTab';
import { CsvPreviewTable } from './detail/CsvPreviewTable';

async function fetchAttachmentPreview(attachmentId: string): Promise<FilePreviewContent | null> {
  try {
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
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pause media saat modal tutup (cegah audio jalan di background)
  React.useEffect(() => {
    return () => {
      try {
        audioRef.current?.pause();
        videoRef.current?.pause();
      } catch {
        /* ignore */
      }
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Keyboard accessibility: Escape key closes modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

  // Pause media saat attachment berganti
  React.useEffect(() => {
    try {
      audioRef.current?.pause();
      videoRef.current?.pause();
    } catch {
      /* ignore */
    }
  }, [activeAttachment?.id, item.id]);

  const handleCopyPreviewText = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedPreviewText(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedPreviewText(false), 2000);
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
        // Validasi ketat: tolak confidence:"tinggi", suggestedTags:"bukan-array" dkk.
        // Sebelumnya JSON.parse mentah langsung masuk SQLite lalu crash saat render.
        let parsed = { category: 'General', confidence: 0.8, suggestedTags: [] as string[] };
        try {
          const ClassifySchema = z.object({
            category: z.string().max(50).default('General'),
            confidence: z.number().min(0).max(1).default(0.8),
            suggestedTags: z.array(z.string().max(30)).max(10).default([]),
          });
          // Normalisasi key LLM yang bervariasi (category/classification, confidence/score)
          const normalized = raw
            .replace(/"classification"\s*:/g, '"category":')
            .replace(/"score"\s*:/g, '"confidence":')
            .replace(/"suggested_tags"\s*:/g, '"suggestedTags":')
            .replace(/"tags"\s*:/g, '"suggestedTags":');
          const v = extractValidJson(normalized, ClassifySchema) as {
            category?: string;
            confidence?: number;
            suggestedTags?: string[];
          };
          parsed = {
            category: (v.category ?? 'General').trim().slice(0, 50) || 'General',
            confidence: typeof v.confidence === 'number' ? v.confidence : 0.8,
            suggestedTags: (v.suggestedTags ?? []).map((t) => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 10),
          };
        } catch {
          /* pakai fallback General */
        }
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
        <ItemDetailHeader
          item={item}
          hasFiles={hasFiles}
          activeMeta={activeMeta}
          activePreviewUrl={activePreviewUrl}
          onClose={onClose}
          onDownloadAttachment={() => handleDownloadAttachment()}
          onRestore={onRestore}
          onPermanentDelete={onPermanentDelete}
          onTrash={onTrash}
          onToggleFavorite={() => onUpdate(item.id, { favorite: !item.favorite })}
          onToggleArchive={() => onUpdate(item.id, { archived: !item.archived })}
        />

        {/* ── File Preview Hero Stage (Shown prominently when item is or has files) ── */}
        <FilePreviewStage
          hasFiles={hasFiles}
          activeMeta={activeMeta}
          activeFileName={activeFileName}
          activeAttachment={activeAttachment}
          isImage={isImage}
          isPdf={isPdf}
          isVideo={isVideo}
          isAudio={isAudio}
          isTextLike={isTextLike}
          isMarkdown={isMarkdown}
          isCsv={isCsv}
          isDocx={isDocx}
          isCode={isCode}
          isZoomed={isZoomed}
          loadingPreview={loadingPreview}
          resolvedPreviewUrl={resolvedPreviewUrl}
          pdfBlobUrl={pdfBlobUrl}
          resolvedTextContent={resolvedTextContent}
          textPreviewMode={textPreviewMode}
          copiedPreviewText={copiedPreviewText}
          filePreview={filePreview}
          selectedAttachmentIdx={selectedAttachmentIdx}
          videoRef={videoRef}
          audioRef={audioRef}
          onToggleZoom={() => setIsZoomed((z) => !z)}
          onOpenLightbox={() => setIsLightboxOpen(true)}
          onDownloadAttachment={handleDownloadAttachment}
          onOpenInSystemViewer={handleOpenInSystemViewer}
          onSetTextPreviewMode={setTextPreviewMode}
          onCopyPreviewText={handleCopyPreviewText}
          onSelectAttachmentIdx={(idx) => {
            setSelectedAttachmentIdx(idx);
            setIsZoomed(false);
          }}
          attachments={item.attachments}
        />

        {/* ── Title & Metadata Bar ── */}
        <ItemDetailMetaBar
          item={item}
          isEditing={isEditing}
          title={title}
          allTags={allTags}
          isTagRecOpen={isTagRecOpen}
          tagRecommendations={tagRecommendations}
          aiEnabled={settings.aiEnabled}
          isAiLoading={isAiLoading}
          onTitleChange={setTitle}
          onSaveEdit={handleSaveEdit}
          onStartEdit={() => setIsEditing(true)}
          onUpdate={onUpdate}
          onCreateTag={onCreateTag}
          onApplyRecommendedTags={handleApplyRecommendedTags}
          onDismissTagRec={() => setIsTagRecOpen(false)}
          onRunAiTags={() => runAiAction('tags')}
        />

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
          <ItemDetailContentTab
            item={item}
            hasFiles={hasFiles}
            isEditing={isEditing}
            content={content}
            displayedNotes={displayedNotes}
            aiEnabled={settings.aiEnabled}
            isAiLoading={isAiLoading}
            onContentChange={setContent}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={() => {
              setTitle(item.title);
              setContent(displayedNotes);
              setIsEditing(false);
            }}
            onStartEdit={() => {
              setContent(displayedNotes);
              setIsEditing(true);
            }}
            onExtractTasks={() => runAiAction('extract_tasks')}
          />
        )}

        {/* ── Tab 2: File Specs & Details (Shown when file item) ── */}
        {activeTab === 'specs' && hasFiles && (
          <ItemDetailSpecsTab
            item={item}
            activeFileName={activeFileName}
            activeMeta={activeMeta}
            activeAttachment={activeAttachment}
            activePreviewUrl={activePreviewUrl}
            onDownloadAttachment={() => handleDownloadAttachment()}
          />
        )}

        {/* ── Tab 3: AI Actions & Context Q&A ── */}
        {activeTab === 'ai' && (
          <ItemDetailAiTab
            item={item}
            aiEnabled={settings.aiEnabled}
            providerDisplayName={getProviderDisplayName(settings)}
            isAiLoading={isAiLoading}
            activeAiAction={activeAiAction}
            aiError={aiError}
            chatMessages={chatMessages}
            chatInput={chatInput}
            onEnableAi={() => updateSettings({ aiEnabled: true })}
            onRunAiAction={runAiAction}
            onChatInputChange={setChatInput}
            onSendChat={handleSendChat}
          />
        )}

        {/* ── Tab 4: Attachments ── */}
        {activeTab === 'attachments' && (
          <ItemDetailAttachmentsTab attachments={item.attachments} />
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
