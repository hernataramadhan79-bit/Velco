import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Square,
  Trash2,
  Sparkles,
  Bot,
  User,
  Check,
  Copy,
  FileText,
  CheckSquare,
  Layers,
  AlertCircle,
  AlertTriangle,
  Cpu,
  Globe,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useContextStore } from '../../stores/contextStore';
import { LlmProviderConfig, ChatMessage } from '../../types/ai';
import { MarkdownViewer } from '../common/MarkdownViewer';
import { db } from '../../services/database';

interface FoundryChatProps {
  providerConfig: LlmProviderConfig;
  activeProviderName?: string;
  activeModelName?: string;
  isLocal?: boolean;
  onArtifactCreated?: (msg: string) => void;
  onOpenSettings?: () => void;
}

export const FoundryChat: React.FC<FoundryChatProps> = ({
  providerConfig,
  activeProviderName = 'AI Engine',
  activeModelName = '',
  isLocal = false,
  onArtifactCreated,
  onOpenSettings,
}) => {
  const { stagedItems, totalTokens } = useContextStore();
  const {
    messages,
    isGenerating,
    sendMessage,
    stopGenerating,
    clearChat,
  } = useChatStore();

  const [inputPrompt, setInputPrompt] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [savedTaskId, setSavedTaskId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const tokens = totalTokens();

  // Auto-scroll to bottom as tokens stream in
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = async () => {
    const trimmed = inputPrompt.trim();
    if (!trimmed || isGenerating) return;

    setInputPrompt('');
    await sendMessage(trimmed, stagedItems, providerConfig);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveAsNote = async (msg: ChatMessage) => {
    if (!msg.content.trim()) return;

    try {
      // Derive a meaningful note title from the first sentence or heading
      const cleanText = msg.content.replace(/^[#\s*>-]+/, '').trim();
      const firstLine = cleanText.split('\n')[0] || 'AI Note';
      const title = firstLine.slice(0, 60) + (firstLine.length > 60 ? '...' : '');

      await db.createItem({
        type: 'note',
        title: `AI Note: ${title}`,
        content: msg.content,
        source: 'foundry_chat',
      });

      setSavedNoteId(msg.id);
      setTimeout(() => setSavedNoteId(null), 2500);

      if (onArtifactCreated) {
        onArtifactCreated(`Saved note: "${title}"`);
      }
    } catch (err: any) {
      console.error('Failed to save note:', err);
    }
  };

  const handleExtractTask = async (msg: ChatMessage) => {
    if (!msg.content.trim()) return;

    try {
      const cleanText = msg.content.replace(/^[#\s*>-]+/, '').trim();
      const firstLine = cleanText.split('\n')[0] || 'Review AI synthesis';
      const title = firstLine.slice(0, 80);

      await db.createItem({
        type: 'task',
        title: title,
        content: msg.content,
        source: 'foundry_chat',
        task: {
          priority: 'medium',
          completed: false,
        },
      });

      setSavedTaskId(msg.id);
      setTimeout(() => setSavedTaskId(null), 2500);

      if (onArtifactCreated) {
        onArtifactCreated(`Created task: "${title}"`);
      }
    } catch (err: any) {
      console.error('Failed to create task:', err);
    }
  };

  const quickPrompts = stagedItems.length > 0
    ? [
        {
          label: 'Synthesize & Compare',
          prompt: 'Cross-examine these staged items. What are the key patterns, connections, and contradictions?',
        },
        {
          label: 'Extract Next Actions',
          prompt: 'Identify all actionable tasks, follow-ups, and deadlines mentioned across the staged items.',
        },
        {
          label: 'Executive Briefing',
          prompt: 'Draft an executive briefing summarizing the core conclusions and takeaways from these sources.',
        },
        {
          label: 'Critical Gaps',
          prompt: 'What critical information or perspectives appear to be missing from these staged items?',
        },
      ]
    : [
        {
          label: 'Task Planning',
          prompt: 'Help me break down a high-level project into structured milestones and tasks.',
        },
        {
          label: 'Note Organization',
          prompt: 'How can I best structure my research notes and bookmarks for maximum recall?',
        },
      ];

  const isCloudWithoutKey =
    !isLocal &&
    providerConfig.type === 'OpenAiCompatible' &&
    !providerConfig.config.api_key?.trim();

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
      {/* Active Context Banner with Engine Badge */}
      <div className="px-4 py-2 bg-white/80 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800 backdrop-blur-sm shrink-0">
        <div className="flex items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="font-semibold text-slate-800 dark:text-slate-200 shrink-0">
              Context:
            </span>
            {stagedItems.length > 0 ? (
              <span className="text-slate-600 dark:text-slate-400 truncate text-[11px]">
                {stagedItems.length} {stagedItems.length === 1 ? 'item' : 'items'} ({tokens.toLocaleString()} tok)
              </span>
            ) : (
              <span className="text-slate-400 italic text-[11px] truncate">
                No items staged (general)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Active Engine Badge with 1-click jump to Settings */}
            <button
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-50 dark:bg-slate-700/60 dark:hover:bg-indigo-950/60 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-medium transition-colors cursor-pointer group"
              title="Click to configure AI engine in Settings"
            >
              {isLocal ? (
                <Cpu className="w-3 h-3 text-indigo-500" />
              ) : (
                <Globe className="w-3 h-3 text-emerald-500" />
              )}
              <span className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 max-w-[85px] truncate">
                {activeProviderName}
              </span>
              {activeModelName && (
                <span className="text-slate-400 font-mono text-[9px] max-w-[75px] truncate hidden sm:inline">
                  · {activeModelName}
                </span>
              )}
              {onOpenSettings && (
                <SettingsIcon className="w-2.5 h-2.5 text-slate-400 group-hover:text-indigo-500 ml-0.5 shrink-0" />
              )}
            </button>

            {messages.length > 0 && (
              <button
                onClick={clearChat}
                disabled={isGenerating}
                className="text-[11px] text-slate-400 hover:text-rose-500 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
                title="Clear conversation"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Staged items mini pills */}
        {stagedItems.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {stagedItems.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-medium shrink-0 max-w-[130px] truncate"
                title={item.title}
              >
                <span className="truncate">{item.title}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Missing Key Warning Banner */}
      {isCloudWithoutKey && (
        <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate text-[11px]">
              API Key untuk <strong>{activeProviderName}</strong> belum diisi.
            </span>
          </div>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-semibold shrink-0 cursor-pointer transition-colors shadow-2xs"
            >
              Isi Key di Settings
            </button>
          )}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-2xs">
              <Bot className="w-5 h-5" />
            </div>
            <div className="space-y-1 max-w-xs mx-auto">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Conversational Context Workstation
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {stagedItems.length > 0
                  ? `Ask questions, synthesize patterns, or extract tasks from the ${stagedItems.length} staged items in your Context Cart.`
                  : 'Stage notes, tasks, or links from your workspace to ground conversations in your personal knowledge.'}
              </p>
            </div>

            {/* Quick Starter Prompts */}
            <div className="pt-2 space-y-1.5 max-w-sm mx-auto text-left">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold px-1">
                Suggested Prompts
              </span>
              <div className="space-y-1.5">
                {quickPrompts.map((qp, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputPrompt(qp.prompt);
                      textareaRef.current?.focus();
                    }}
                    className="w-full p-2 rounded-xl bg-white dark:bg-slate-800/80 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-300 text-left transition-all text-xs group cursor-pointer shadow-2xs"
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 text-[11px] flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      <span>{qp.label}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {qp.prompt}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isCopied = copiedId === msg.id;
            const isNoteSaved = savedNoteId === msg.id;
            const isTaskSaved = savedTaskId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`flex flex-col max-w-[88%] rounded-2xl p-3 shadow-2xs ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-tl-none'
                  }`}
                >
                  {/* Context Badge if user attached items */}
                  {msg.stagedItemTitles && msg.stagedItemTitles.length > 0 && (
                    <div
                      className={`text-[9px] mb-1.5 flex items-center gap-1 font-mono ${
                        isUser ? 'text-blue-100/80' : 'text-indigo-600 dark:text-indigo-400'
                      }`}
                    >
                      <Layers className="w-2.5 h-2.5" />
                      <span className="truncate">
                        Grounded on: {msg.stagedItemTitles.slice(0, 2).join(', ')}
                        {msg.stagedItemTitles.length > 2 ? ` +${msg.stagedItemTitles.length - 2}` : ''}
                      </span>
                    </div>
                  )}

                  {/* Message Content */}
                  {isUser ? (
                    <div className="text-xs leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  ) : (
                    <div>
                      {msg.content ? (
                        <MarkdownViewer content={msg.content} />
                      ) : msg.isStreaming ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 py-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                          <span>Analyzing context...</span>
                        </div>
                      ) : null}

                      {/* Streaming cursor */}
                      {msg.isStreaming && msg.content && (
                        <span className="inline-block w-1.5 h-3 ml-0.5 bg-indigo-500 animate-pulse" />
                      )}

                      {/* Error Banner with Diagnostics & Shortcut */}
                      {msg.error && (
                        <div className="mt-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs space-y-2">
                          <div className="flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
                            <div className="flex-1 break-words text-[11px] leading-relaxed">
                              {msg.error}
                            </div>
                          </div>

                          <div className="pt-1.5 border-t border-rose-200/60 dark:border-rose-800/60 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                            <span>
                              {msg.error.includes('1234')
                                ? 'Server LM Studio (port 1234) tidak aktif.'
                                : msg.error.includes('11434')
                                ? 'Ollama (port 11434) tidak terhubung.'
                                : msg.error.includes('401')
                                ? 'Autentikasi gagal / API key salah.'
                                : 'Periksa konfigurasi AI di Pengaturan.'}
                            </span>
                            {onOpenSettings && (
                              <button
                                onClick={onOpenSettings}
                                className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium cursor-pointer transition-colors shrink-0 ml-2 shadow-2xs"
                              >
                                Buka Settings
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Action Bar on Assistant Responses */}
                      {!msg.isStreaming && msg.content && !msg.error && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400 select-none">
                          <div className="flex items-center gap-1.5">
                            {/* Save as Note */}
                            <button
                              onClick={() => handleSaveAsNote(msg)}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                                isNoteSaved
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-semibold'
                                  : 'hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                              }`}
                              title="Save response as a Note in SQLite"
                            >
                              {isNoteSaved ? (
                                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <FileText className="w-3 h-3" />
                              )}
                              <span>{isNoteSaved ? 'Saved to Notes' : 'Save Note'}</span>
                            </button>

                            {/* Extract as Task */}
                            <button
                              onClick={() => handleExtractTask(msg)}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                                isTaskSaved
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-semibold'
                                  : 'hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                              }`}
                              title="Extract as an actionable Task in SQLite"
                            >
                              {isTaskSaved ? (
                                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <CheckSquare className="w-3 h-3" />
                              )}
                              <span>{isTaskSaved ? 'Task Created' : 'Add Task'}</span>
                            </button>
                          </div>

                          {/* Copy Text */}
                          <button
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded transition-colors cursor-pointer"
                            title="Copy response"
                          >
                            {isCopied ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Dock */}
      <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-2">
        <div className="relative flex items-end gap-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/90 dark:border-slate-800 p-1.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all shadow-2xs">
          <textarea
            ref={textareaRef}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              stagedItems.length > 0
                ? `Ask about the ${stagedItems.length} staged items... (Enter to send)`
                : 'Ask anything or stage items to ground context... (Enter to send)'
            }
            rows={2}
            className="flex-1 bg-transparent text-xs p-1.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none resize-none leading-relaxed max-h-28"
          />

          <div className="flex items-center gap-1 shrink-0 pb-0.5">
            {isGenerating ? (
              <button
                onClick={stopGenerating}
                className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
                title="Stop generation"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!inputPrompt.trim()}
                className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
                title="Send message (Enter)"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
          <span>
            <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">Enter</kbd> send, <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">Shift+Enter</kbd> newline
          </span>
          <span className="font-mono">
            {stagedItems.length} in context cart
          </span>
        </div>
      </div>
    </div>
  );
};
