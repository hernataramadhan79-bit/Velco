import React, { useState } from 'react';
import { Item, Tag, PriorityLevel } from '../../types/item';
import { Modal } from '../common/Modal';
import { ItemTagsEditor } from './ItemTagsEditor';
import { Badge } from '../common/Badge';
import {
  FileText,
  CheckSquare,
  Link2,
  Calendar,
  ExternalLink,
  Sparkles,
  MessageSquare,
  Tag as TagIcon,
  ListTodo,
  Bot,
  Copy,
  Trash2,
  Paperclip,
  Check,
  Star,
  Archive,
  RefreshCw,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { useSettings } from '../../stores/settingsStore';
import { aiRouter, OllamaProvider, LMStudioProvider } from '../../services/ai';

interface ItemDetailModalProps {
  item: Item | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Item>) => Promise<any>;
  onTrash: (id: string) => void;
  allTags: Tag[];
  onCreateTag: (name: string) => Promise<Tag>;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  onUpdate,
  onTrash,
  allTags,
  onCreateTag,
}) => {
  if (!item) return null;

  const { settings, updateSettings } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeAiAction, setActiveAiAction] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'ai' | 'attachments'>('content');
  const [chatMessages, setChatMessages] = useState<
    { role: 'user' | 'assistant'; content: string; time: string }[]
  >([]);
  const [chatInput, setChatInput] = useState('');

  const getActiveAI = () => {
    return aiRouter.getActiveInfo(settings);
  };

  // AI Actions implementation
  const runAiAction = async (
    action: 'summarize' | 'classify' | 'tags' | 'explain' | 'extract_tasks'
  ) => {
    if (!settings.aiEnabled) {
      setAiError('AI is currently disabled in settings.');
      return;
    }
    const textToProcess = `${item.title}\n\n${item.content}`;
    if (!textToProcess.trim()) {
      setAiError('Item has no content to process.');
      return;
    }

    const active = getActiveAI();
    if (!active) {
      setAiError('No active AI provider configured. Please check Settings.');
      return;
    }

    setIsAiLoading(true);
    setActiveAiAction(action);
    setAiError(null);

    try {
      const isOnline = await active.provider.isAvailable();
      if (!isOnline) {
        throw new Error(
          active.isLocal
            ? `AI provider (${active.name}) is unreachable at ${active.endpoint}. Make sure your local server is running.`
            : `Cloud AI provider (${active.name}) is not connected. Please verify your API key in Settings.`
        );
      }

      if (action === 'summarize') {
        const summary = await active.provider.summarize(textToProcess, active.model);
        await onUpdate(item.id, {
          aiMetadata: {
            id: crypto.randomUUID(),
            itemId: item.id,
            provider: active.name,
            model: active.model,
            summary,
            processedAt: new Date().toISOString(),
          },
        });
        setActiveTab('ai');
      } else if (action === 'classify') {
        const res = await active.provider.classify(textToProcess, active.model);
        await onUpdate(item.id, {
          aiMetadata: {
            id: crypto.randomUUID(),
            itemId: item.id,
            provider: active.name,
            model: active.model,
            classification: res.category,
            confidence: res.confidence,
            suggestedTags: res.suggestedTags,
            processedAt: new Date().toISOString(),
          },
        });
        setActiveTab('ai');
      } else if (action === 'tags') {
        const suggested = await active.provider.suggestTags(
          textToProcess,
          allTags.map((t) => t.name),
          active.model
        );
        for (const tagName of suggested) {
          const created = await onCreateTag(tagName);
          if (!item.tags.some((t) => t.id === created.id)) {
            await onUpdate(item.id, { tags: [...item.tags, created] });
          }
        }
      } else if (action === 'explain') {
        const answer = await active.provider.askContext(
          textToProcess,
          [],
          'Explain what this item is about and its main takeaways in clear terms.',
          active.model
        );
        setChatMessages((prev) => [
          ...prev,
          { role: 'user', content: 'Explain this item', time: new Date().toLocaleTimeString() },
          { role: 'assistant', content: answer, time: new Date().toLocaleTimeString() },
        ]);
        setActiveTab('ai');
      } else if (action === 'extract_tasks') {
        const answer = await active.provider.askContext(
          textToProcess,
          [],
          'Extract actionable next steps or tasks from this content as a checklist.',
          active.model
        );
        setChatMessages((prev) => [
          ...prev,
          { role: 'user', content: 'Extract tasks from this item', time: new Date().toLocaleTimeString() },
          { role: 'assistant', content: answer, time: new Date().toLocaleTimeString() },
        ]);
        setActiveTab('ai');
      }
    } catch (err: any) {
      setAiError(err.message || 'AI operation failed');
    } finally {
      setIsAiLoading(false);
      setActiveAiAction(null);
    }
  };

  const handleSendChat = async () => {
    if (!settings.aiEnabled) {
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
      const active = getActiveAI();
      if (!active) {
        throw new Error('No AI provider configured. Please check Settings.');
      }
      const isOnline = await active.provider.isAvailable();
      if (!isOnline) {
        throw new Error(
          active.isLocal
            ? `AI provider (${active.name}) is unreachable at ${active.endpoint}.`
            : `Cloud AI provider (${active.name}) is not connected. Please verify your API key in Settings.`
        );
      }

      const answer = await active.provider.askContext(
        `${item.title}\n\n${item.content}`,
        chatMessages as any,
        userMsg,
        active.model
      );

      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: answer, time: new Date().toLocaleTimeString() },
      ]);
    } catch (err: any) {
      setAiError(err.message || 'Chat request failed');
    } finally {
      setIsAiLoading(false);
      setActiveAiAction(null);
    }
  };

  const handleSaveEdit = async () => {
    await onUpdate(item.id, {
      title: title.trim() || 'Untitled',
      content,
    });
    setIsEditing(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="2xl">
      <div className="space-y-4">
        {/* Top Navigation & Actions Bar */}
        <div className="flex items-center justify-between pb-3 -mt-1 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-2xs"
            title="Back to workspace (Esc)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
            <kbd className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-500 font-mono">
              Esc
            </kbd>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onUpdate(item.id, { favorite: !item.favorite })}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                item.favorite
                  ? 'border-amber-300 bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:border-amber-700'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-amber-500'
              }`}
              title="Favorite"
            >
              <Star className="w-4 h-4" />
            </button>
            <button
              onClick={() => onUpdate(item.id, { archived: !item.archived })}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                item.archived
                  ? 'border-blue-300 bg-blue-50 text-blue-600 dark:bg-blue-950/40'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-blue-500'
              }`}
              title="Archive"
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                onTrash(item.id);
                onClose();
              }}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              title="Trash"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Title bar */}
        <div className="flex items-start justify-between gap-4 pb-1">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant="default">{item.type}</Badge>
              <span className="text-[11px] text-slate-400 font-mono">
                Created {new Date(item.createdAt).toLocaleString()}
              </span>
            </div>

            {isEditing ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-2 py-1 text-base font-bold rounded bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            ) : (
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {item.title}
              </h2>
            )}
          </div>

          <button
            onClick={() => (isEditing ? handleSaveEdit() : setIsEditing(true))}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
          >
            {isEditing ? 'Done' : 'Edit'}
          </button>
        </div>

        {/* Task row if task */}
        {item.type === 'task' && item.task && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-xs">
            <label className="flex items-center gap-2 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={item.task.completed}
                onChange={(e) =>
                  onUpdate(item.id, {
                    task: {
                      ...item.task!,
                      completed: e.target.checked,
                      completedAt: e.target.checked ? new Date().toISOString() : null,
                    },
                  })
                }
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
              />
              <span className={item.task.completed ? 'line-through text-slate-400' : ''}>
                {item.task.completed ? 'Completed' : 'Pending Task'}
              </span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Priority:</span>
              {(['low', 'medium', 'high', 'urgent'] as PriorityLevel[]).map((p) => (
                <button
                  key={p}
                  onClick={() =>
                    onUpdate(item.id, { task: { ...item.task!, priority: p } })
                  }
                  className={`px-2 py-0.5 rounded capitalize font-medium cursor-pointer ${
                    item.task?.priority === p
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Link preview row if link */}
        {item.type === 'link' && item.link && (
          <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-blue-900 dark:text-blue-200 truncate">
                {item.link.pageTitle || item.link.url}
              </div>
              <div className="text-[11px] text-blue-600 dark:text-blue-400 font-mono truncate">
                {item.link.url}
              </div>
            </div>
            <a
              href={item.link.url}
              target="_blank"
              rel="noreferrer"
              className="ml-3 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <span>Open</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Tags Editor */}
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Tags
          </label>
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
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pt-2 text-xs">
          <button
            onClick={() => setActiveTab('content')}
            className={`pb-2 px-1 font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'content'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Content & Notes
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`pb-2 px-1 font-semibold border-b-2 flex items-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'ai'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Actions & Chat</span>
            {item.aiMetadata?.summary && (
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            )}
          </button>
          {item.attachments && item.attachments.length > 0 && (
            <button
              onClick={() => setActiveTab('attachments')}
              className={`pb-2 px-1 font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'attachments'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Attachments ({item.attachments.length})
            </button>
          )}
        </div>

        {/* Tab 1: Content */}
        {activeTab === 'content' && (
          <div className="space-y-4">
            {/* Visual Attachment Previews if any */}
            {item.attachments && item.attachments.length > 0 && (
              <div className="space-y-3">
                {item.attachments.map((att) => {
                  const isImage =
                    att.mimeType.startsWith('image/') ||
                    att.fileName.match(/\.(png|jpe?g|webp|gif|svg)$/i);

                  if (isImage && att.dataUrl) {
                    return (
                      <div
                        key={att.id}
                        className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-1 shadow-xs"
                      >
                        <img
                          src={att.dataUrl}
                          alt={att.fileName}
                          className="w-full max-h-[380px] object-contain rounded-xl"
                        />
                        <div className="p-2 flex items-center justify-between text-xs text-slate-500">
                          <span className="font-medium truncate">{att.fileName}</span>
                          <span className="font-mono text-[10px]">
                            {(att.fileSize / 1024).toFixed(1)} KB
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                          <Paperclip className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {att.fileName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {(att.fileSize / 1024).toFixed(1)} KB • {att.mimeType}
                          </div>
                        </div>
                      </div>
                      {att.dataUrl && (
                        <a
                          href={att.dataUrl}
                          download={att.fileName}
                          className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors"
                        >
                          Download
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {isEditing ? (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Markdown content..."
              />
            ) : (
              item.content ? (
                <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 min-h-[100px] text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {item.content}
                </div>
              ) : null
            )}

            <div className="flex items-center justify-between pt-1">
              <div className="text-[11px] text-slate-400 font-mono">
                {item.content ? `${item.content.split(/\s+/).filter(Boolean).length} words` : '0 words'}
              </div>

              {isEditing ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTitle(item.title);
                      setContent(item.content);
                      setIsEditing(false);
                    }}
                    className="px-3 py-1 text-xs rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Save Changes
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                >
                  Edit Note
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: AI Actions & Context Q&A */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            {!settings.aiEnabled ? (
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center space-y-3">
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
                    Actions ({settings.aiProvider === 'lmstudio' ? 'LM Studio / OpenAI' : 'Ollama'})
                  </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => runAiAction('summarize')}
                  disabled={isAiLoading}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="flex items-center gap-2 py-1 px-2.5 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500 shrink-0" />
                <span>Processing AI request...</span>
              </div>
            )}

            {/* Error banner */}
            {aiError && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                {aiError}
              </div>
            )}

            {/* AI Summary View */}
            {item.aiMetadata?.summary && (
              <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-800 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-purple-700 dark:text-purple-300">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Summary ({item.aiMetadata.model})</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(item.aiMetadata.processedAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {item.aiMetadata.summary}
                </p>
                {item.aiMetadata.classification && (
                  <div className="pt-1 text-[11px] text-slate-500">
                    Category: <span className="font-semibold">{item.aiMetadata.classification}</span>
                  </div>
                )}
              </div>
            )}

            {/* Context-bound AI Chat */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/40 dark:bg-slate-900/40">
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span>Ask About This Item</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  Context bounded to this note
                </span>
              </div>

              <div className="p-3 max-h-48 overflow-y-auto space-y-2 text-xs">
                {chatMessages.length === 0 ? (
                  <div className="text-slate-400 text-center py-4 text-[11px]">
                    Ask any question about this item's content.
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded-lg leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-950 dark:text-blue-100 ml-6'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 mr-6 border border-slate-200/80 dark:border-slate-700'
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
                  <div className="flex items-center gap-2 py-1 px-2.5 rounded-md bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-500 border border-slate-200/60 dark:border-slate-700/60 w-fit">
                    <Loader2 className="w-3 h-3 animate-spin text-purple-500 shrink-0" />
                    <span>Typing response...</span>
                  </div>
                )}
              </div>

              <div className="p-2 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5 bg-white dark:bg-slate-900">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendChat();
                  }}
                  placeholder="Ask a question..."
                  disabled={isAiLoading}
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleSendChat}
                  disabled={isAiLoading || !chatInput.trim()}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer flex items-center gap-1"
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
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              >
                <div className="flex items-center gap-3">
                  {att.mimeType.startsWith('image/') && att.dataUrl ? (
                    <img
                      src={att.dataUrl}
                      alt={att.fileName}
                      className="w-10 h-10 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="p-2 rounded-lg bg-slate-200 dark:bg-slate-700">
                      <Paperclip className="w-5 h-5 text-slate-500" />
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {att.fileName}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {(att.fileSize / 1024).toFixed(1)} KB • {att.mimeType}
                    </div>
                  </div>
                </div>

                {att.dataUrl && (
                  <a
                    href={att.dataUrl}
                    download={att.fileName}
                    className="px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-medium"
                  >
                    Download
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
