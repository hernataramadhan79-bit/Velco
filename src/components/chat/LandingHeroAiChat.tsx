import React, { useState, useEffect, useRef } from 'react';
import {
  Square,
  Trash2,
  Bot,
  User,
  Check,
  Copy,
  FileText,
  Layers,
  AlertCircle,
  Cpu,
  Globe,
  Settings as SettingsIcon,
  Loader2,
  ListTodo,
  Paperclip,
  X,
  Search,
  CornerDownLeft,
  Calendar,
  BarChart3,
  Lightbulb,
  SlidersHorizontal,
  Plus,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useContextStore, itemToStagedItem } from '../../stores/contextStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useSettings } from '../../stores/settingsStore';
import { useItemStore } from '../../stores/itemStore';
import { formatTaskBatchSource } from '../../types/item';
import {
  StructuredTaskItem,
  extractStructuredTasks,
  generateCleanBatchTitle,
  smartHeuristicTaskExtraction,
} from '../../services/ai/taskExtractor';
import { TaskExtractionModal } from '../tasks/TaskExtractionModal';
import { MarkdownViewer } from '../common/MarkdownViewer';
import { db } from '../../services/database';
import { getProviderDisplayName, getLlmProviderConfig } from '../../utils/aiUtils';

interface LandingHeroAiChatProps {
  onArtifactCreated?: (msg: string) => void;
  onOpenSettings?: () => void;
}

interface SmartPromptChip {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  prompt: string;
}

const DEVELOPER_PROMPT_CHIPS: SmartPromptChip[] = [
  {
    icon: Calendar,
    label: 'Prioritize tasks & deadlines',
    prompt: 'What are my highest priority tasks and approaching deadlines based on items in Velco? Outline a sequential execution plan.',
  },
  {
    icon: BarChart3,
    label: 'Synthesize recent notes',
    prompt: 'Please draft an executive synthesis of my recent notes, updates, and research stored in the workstation.',
  },
  {
    icon: Lightbulb,
    label: 'Brainstorm next steps',
    prompt: 'Analyze my active context items and brainstorm 3-5 concrete architectural or procedural next steps.',
  },
  {
    icon: Search,
    label: 'Analyze gaps & blockers',
    prompt: 'Based on available workstation context, identify potential contradictions, gaps, or dependencies that require resolution.',
  },
];

export const LandingHeroAiChat: React.FC<LandingHeroAiChatProps> = ({
  onArtifactCreated,
  onOpenSettings,
}) => {
  const { messages, isGenerating, sendMessage, stopGenerating, clearChat } = useChatStore();
  const {
    chatContextItems,
    addChatContextItem,
    removeChatContextItem,
    clearChatContext,
    totalChatTokens,
  } = useContextStore();
  const { items: allDbItems } = useItemStore();
  const { settings, updateSettings } = useSettings();

  const [prompt, setPrompt] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [extractingMsgId, setExtractingMsgId] = useState<string | null>(null);
  const [savedBatchMsgId, setSavedBatchMsgId] = useState<string | null>(null);
  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState<StructuredTaskItem[]>([]);
  const [extractBatchTitle, setExtractBatchTitle] = useState<string>('');
  const [isContextPickerOpen, setIsContextPickerOpen] = useState(false);
  const [contextSearch, setContextSearch] = useState('');
  const [showParameters, setShowParameters] = useState(false);
  const [temperature, setTemperature] = useState(0.7);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const providerInfo = getProviderDisplayName(settings);
  const chatTokens = totalChatTokens();

  // Auto-scroll chat to latest message on update
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  // Click outside listener to close context picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsContextPickerOpen(false);
      }
    };
    if (isContextPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isContextPickerOpen]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  const handleSend = (textToSend?: string) => {
    const content = textToSend || prompt.trim();
    if (!content || isGenerating || !settings.aiEnabled) return;

    // Send with context & provider config
    const config = getLlmProviderConfig(settings);
    sendMessage(content, chatContextItems, config);
    setPrompt('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
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

  const handleSaveToNote = async (msgId: string, content: string) => {
    try {
      const title = content.slice(0, 50).trim() || 'Chat Note';
      await db.createItem({
        type: 'note',
        title,
        content,
        source: 'ai_chat',
      });
      await useItemStore.getState().refreshItems();
      await useItemStore.getState().refreshCounts();
      setSavedNoteId(msgId);
      setTimeout(() => setSavedNoteId(null), 3000);

      if (onArtifactCreated) {
        onArtifactCreated(`Saved note: "${title}"`);
      }
    } catch (err) {
      console.error('Failed to save chat message as note:', err);
    }
  };

  const handleExtractTasksFromMessage = async (msg: { id: string; content: string }) => {
    setExtractingMsgId(msg.id);
    try {
      const generatedTitle = generateCleanBatchTitle(msg.content, 'Chat Action Items');
      setExtractBatchTitle(generatedTitle);

      if (!settings.aiEnabled) {
        const fallback = smartHeuristicTaskExtraction(msg.content);
        if (fallback.length > 0) {
          setExtractedTasks(fallback);
          setIsExtractModalOpen(true);
        }
        return;
      }

      const llmConfig = getLlmProviderConfig(settings);
      const model = llmConfig.config.model;
      const baseUrl = llmConfig.config.base_url;
      const apiKey = 'api_key' in llmConfig.config ? llmConfig.config.api_key : undefined;

      const tasks = await extractStructuredTasks(msg.content, model, baseUrl, apiKey);
      if (tasks.length > 0) {
        setExtractedTasks(tasks);
        setIsExtractModalOpen(true);
      } else {
        const fallback = smartHeuristicTaskExtraction(msg.content);
        if (fallback.length > 0) {
          setExtractedTasks(fallback);
          setIsExtractModalOpen(true);
        }
      }
    } catch (err: any) {
      const fallback = smartHeuristicTaskExtraction(msg.content);
      if (fallback.length > 0) {
        setExtractedTasks(fallback);
        setIsExtractModalOpen(true);
      }
    } finally {
      setExtractingMsgId(null);
    }
  };

  const handleConfirmExtractTasks = async (tasksToCreate: StructuredTaskItem[]) => {
    if (tasksToCreate.length === 0) return;
    try {
      const batchId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const batchSourceStr = formatTaskBatchSource({
        origin: 'ai_chat',
        batchId,
        batchTitle: extractBatchTitle || 'Chat Tasks',
      });

      for (const t of tasksToCreate) {
        await db.createItem({
          type: 'task',
          title: t.title,
          content: t.description || '',
          source: batchSourceStr,
          task: {
            priority: t.priority || 'medium',
            completed: false,
            dueDate: t.dueDate,
          },
        });
      }

      await useItemStore.getState().refreshItems();
      await useItemStore.getState().refreshCounts();

      if (extractingMsgId) {
        setSavedBatchMsgId(extractingMsgId);
        setTimeout(() => setSavedBatchMsgId(null), 3000);
      }

      setIsExtractModalOpen(false);

      if (onArtifactCreated) {
        onArtifactCreated(`Created ${tasksToCreate.length} task${tasksToCreate.length > 1 ? 's' : ''}`);
      }
    } catch (err: any) {
      console.error('Failed to save extracted tasks from chat:', err);
    }
  };

  return (
    <div className="w-full min-w-0 bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] overflow-hidden flex flex-col transition-all shadow-xs">
      {/* Top Model Parameter & Telemetry Bar */}
      <div className="px-3.5 py-2 bg-slate-50 dark:bg-[#101014] border-b border-slate-200 dark:border-white/[0.07] flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          {settings.aiEnabled ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] text-[11px] font-mono text-slate-700 dark:text-zinc-300">
              {providerInfo.isLocal ? (
                <Cpu className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Globe className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
              )}
              <span className="truncate max-w-[160px] sm:max-w-[220px]">
                {providerInfo.providerName} &bull; {providerInfo.modelName}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => updateSettings({ aiEnabled: true })}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-[11px] font-mono text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
              title="AI is currently disabled. Click to turn ON."
            >
              <ShieldAlert className="w-3 h-3 text-amber-500 shrink-0" />
              <span>AI Disabled (Click to Turn On)</span>
            </button>
          )}

          {chatContextItems.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-300 font-mono text-[10px]">
              <Layers className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span>{chatContextItems.length} context ({chatTokens.toLocaleString()}t)</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowParameters(!showParameters)}
            className={`p-1 rounded text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors cursor-pointer ${
              showParameters ? 'bg-slate-200 dark:bg-white/[0.08] text-slate-800 dark:text-zinc-200' : 'hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
            title="Model parameters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>

          {messages.length > 0 && (
            <button
              onClick={clearChat}
              disabled={isGenerating}
              className="px-2 py-0.8 text-[11px] font-mono text-slate-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="Clear conversation"
            >
              <Trash2 className="w-3 h-3 stroke-[1.5]" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-1 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded transition-colors cursor-pointer"
              title="Configure Model Engine"
            >
              <SettingsIcon className="w-3.5 h-3.5 stroke-[1.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Optional Parameter Drawer */}
      {showParameters && (
        <div className="px-4 py-2.5 bg-slate-100/80 dark:bg-[#0d0d10] border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between gap-4 text-xs font-mono text-slate-600 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-zinc-500 text-[11px]">Temperature:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-24 h-1 bg-slate-300 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-slate-800 dark:text-zinc-300 text-[11px]">{temperature}</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-500">
            <span>Context Limit:</span>
            <span className="text-slate-800 dark:text-zinc-300">8192t</span>
          </div>
        </div>
      )}

      {/* Conversation Thread Area */}
      {messages.length > 0 && (
        <div
          ref={chatContainerRef}
          className="p-4 space-y-4 max-h-[420px] overflow-y-auto overflow-x-hidden border-b border-slate-200 dark:border-white/[0.06] bg-slate-50/60 dark:bg-[#09090b]/50 w-full min-w-0"
        >
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isSavedNote = savedNoteId === msg.id;
            const isExtracting = extractingMsgId === msg.id;
            const isSavedBatch = savedBatchMsgId === msg.id;
            const isCopied = copiedId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 text-xs w-full min-w-0 ${
                  isUser ? 'justify-end' : 'justify-start'
                }`}
              >
                {!isUser && (
                  <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-zinc-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 stroke-[1.5]" />
                  </div>
                )}

                <div
                  className={`flex flex-col max-w-[88%] min-w-0 ${
                    isUser ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`p-3 rounded-lg leading-relaxed break-words overflow-hidden min-w-0 ${
                      isUser
                        ? 'bg-slate-100 text-slate-900 border border-slate-200 dark:bg-white/[0.06] dark:border-white/[0.08] dark:text-zinc-100'
                        : 'text-slate-800 dark:text-zinc-200'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="prose prose-slate dark:prose-invert prose-xs max-w-none text-slate-800 dark:text-zinc-200">
                        <MarkdownViewer content={msg.content} />
                      </div>
                    )}
                  </div>

                  {/* Message Action Bar (Assistant Only) */}
                  {!isUser && (
                    <div className="flex items-center gap-1 mt-1 px-1">
                      <button
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
                        title="Copy response"
                      >
                        {isCopied ? (
                          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[2]" />
                        ) : (
                          <Copy className="w-3 h-3 stroke-[1.5]" />
                        )}
                      </button>

                      <button
                        onClick={() => handleSaveToNote(msg.id, msg.content)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer ${
                          isSavedNote
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-white/[0.04]'
                        }`}
                        title="Save response to a new Note"
                      >
                        <FileText className="w-2.5 h-2.5" />
                        <span>{isSavedNote ? 'Saved' : 'Save as Note'}</span>
                      </button>

                      <button
                        onClick={() => handleExtractTasksFromMessage(msg)}
                        disabled={isExtracting}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer ${
                          isSavedBatch
                            ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'
                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-white/[0.04]'
                        }`}
                        title="Extract actionable tasks from this response"
                      >
                        {isExtracting ? (
                          <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-500 dark:text-blue-400" />
                        ) : (
                          <ListTodo className="w-2.5 h-2.5" />
                        )}
                        <span>{isSavedBatch ? 'Extracted' : 'Extract Tasks'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-zinc-300 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 stroke-[1.5]" />
                  </div>
                )}
              </div>
            );
          })}

          {isGenerating && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500 font-mono py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 dark:text-blue-400" />
              <span>Generating response...</span>
            </div>
          )}
        </div>
      )}

      {/* Suggested Prompts (Zero Emojis, Pure Monospace Vector Chips) */}
      {messages.length === 0 && !prompt.trim() && (
        <div className="p-4 space-y-2.5">
          {!settings.aiEnabled ? (
            <div className="p-4 rounded-xl bg-amber-500/[0.04] dark:bg-amber-500/[0.05] border border-amber-500/20 text-center space-y-2.5">
              <div className="w-8 h-8 mx-auto rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  AI Features are Currently Disabled
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 max-w-sm mx-auto">
                  Turn on AI in Settings or click below to enable workspace chat, synthesis, and reasoning.
                </p>
              </div>
              <button
                type="button"
                onClick={() => updateSettings({ aiEnabled: true })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors cursor-pointer shadow-xs"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Turn On AI</span>
              </button>
            </div>
          ) : (
            <>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-500 font-semibold">
                Suggested Prompts
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DEVELOPER_PROMPT_CHIPS.map((chip, idx) => {
                  const Icon = chip.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSend(chip.prompt)}
                      disabled={isGenerating}
                      className="flex items-center gap-2.5 p-2 rounded-md bg-slate-50 hover:bg-slate-100 dark:bg-[#101014] dark:hover:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.12] text-left transition-all cursor-pointer group disabled:opacity-50"
                    >
                      <Icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 dark:text-zinc-500 dark:group-hover:text-zinc-300 stroke-[1.5] shrink-0" />
                      <span className="text-xs text-slate-600 group-hover:text-slate-900 dark:text-zinc-400 dark:group-hover:text-zinc-200 truncate">
                        {chip.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Attached Chat Context Bar */}
      {chatContextItems.length > 0 && (
        <div className="px-3 py-1.5 bg-slate-50 dark:bg-[#101014] border-t border-b border-slate-200 dark:border-white/[0.06] flex flex-wrap items-center gap-1.5 text-xs">
          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 dark:text-zinc-500 mr-1">
            <Layers className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <span>Context:</span>
          </div>

          {chatContextItems.map((item) => (
            <div
              key={item.id}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.07] text-[11px] font-mono text-slate-700 dark:text-zinc-300"
            >
              <span className="truncate max-w-[150px]">{item.title}</span>
              <button
                type="button"
                onClick={() => removeChatContextItem(item.id)}
                className="p-0.5 text-slate-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400 rounded cursor-pointer"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={clearChatContext}
            className="text-[10px] font-mono text-slate-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400 px-1 py-0.5 rounded cursor-pointer ml-auto"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Input Dock */}
      <div className="p-3 relative bg-white dark:bg-[#141418]">
        {/* Inline Context Picker Popover */}
        {isContextPickerOpen && (
          <div
            ref={pickerRef}
            className="absolute bottom-full left-3 right-3 mb-2 p-3 bg-white dark:bg-[#1a1a20] rounded-xl shadow-2xl border border-slate-200 dark:border-white/[0.1] z-30"
          >
            <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200 dark:border-white/[0.06] text-xs">
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-700 dark:text-zinc-300">
                <Paperclip className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                <span>Attach Items to AI Context</span>
              </div>
              <button
                onClick={() => setIsContextPickerOpen(false)}
                className="p-0.5 text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300 rounded cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="relative mb-2">
              <Search className="w-3 h-3 text-slate-400 dark:text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={contextSearch}
                onChange={(e) => setContextSearch(e.target.value)}
                placeholder="Filter items..."
                className="w-full bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.07] rounded-md pl-7 pr-2.5 py-1 text-xs text-slate-900 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-slate-400 dark:focus:border-white/[0.2]"
              />
            </div>

            <div className="max-h-44 overflow-y-auto space-y-1">
              {allDbItems
                .filter(
                  (item) =>
                    !contextSearch.trim() ||
                    (item.title || '').toLowerCase().includes(contextSearch.toLowerCase()) ||
                    (item.excerpt ?? '').toLowerCase().includes(contextSearch.toLowerCase())
                )
                .slice(0, 8)
                .map((item) => {
                  const isAttached = chatContextItems.some((c) => c.id === item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (isAttached) {
                          removeChatContextItem(item.id);
                        } else {
                          addChatContextItem(itemToStagedItem(item));
                        }
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                        isAttached
                          ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="truncate max-w-[280px]">{item.title || 'Untitled'}</span>
                      <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-600 uppercase">{item.type}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {!settings.aiEnabled && (
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-mono text-[11px]">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>AI features are turned off</span>
            </div>
            <button
              type="button"
              onClick={() => updateSettings({ aiEnabled: true })}
              className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium transition-colors cursor-pointer"
            >
              Turn On AI
            </button>
          </div>
        )}

        <div className={`flex items-end gap-2 bg-slate-50 dark:bg-[#0d0d10] border border-slate-200 dark:border-white/[0.08] focus-within:border-slate-400 dark:focus-within:border-white/[0.18] rounded-lg p-1.5 transition-colors ${
          !settings.aiEnabled ? 'opacity-60 cursor-not-allowed' : ''
        }`}>
          <button
            type="button"
            onClick={() => settings.aiEnabled && setIsContextPickerOpen(!isContextPickerOpen)}
            disabled={!settings.aiEnabled}
            className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-white/[0.05] disabled:opacity-40 transition-colors cursor-pointer shrink-0"
            title="Attach workspace context (+ file, + note)"
          >
            <Paperclip className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={prompt}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            disabled={!settings.aiEnabled}
            placeholder={
              settings.aiEnabled
                ? "Ask anything or request synthesis... (Enter to send, Shift+Enter for newline)"
                : "AI features are turned off. Enable AI to chat..."
            }
            className="flex-1 bg-transparent border-none outline-none resize-none text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 max-h-44 py-1 leading-relaxed disabled:cursor-not-allowed"
          />

          {isGenerating ? (
            <button
              type="button"
              onClick={stopGenerating}
              className="p-1.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-600 dark:text-rose-300 transition-colors cursor-pointer shrink-0"
              title="Stop generation"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!prompt.trim() || !settings.aiEnabled}
              className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white dark:bg-white/[0.08] dark:hover:bg-white/[0.14] dark:text-zinc-200 disabled:opacity-30 transition-all cursor-pointer shrink-0 shadow-2xs"
              title={settings.aiEnabled ? "Send message (Enter)" : "AI is disabled in Settings"}
            >
              <CornerDownLeft className="w-3.5 h-3.5 stroke-[1.75]" />
            </button>
          )}
        </div>
      </div>

      {/* Task Extraction Modal Dialog */}
      <TaskExtractionModal
        isOpen={isExtractModalOpen}
        onClose={() => setIsExtractModalOpen(false)}
        tasks={extractedTasks}
        sourceTitle={extractBatchTitle}
        onConfirm={handleConfirmExtractTasks}
      />
    </div>
  );
};
