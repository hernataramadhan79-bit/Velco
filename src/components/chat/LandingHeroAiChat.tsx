import React, { useState, useRef } from 'react';
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
  Cpu,
  Globe,
  Settings as SettingsIcon,
  ArrowRight,
  Loader2,
  ListTodo,
} from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useContextStore } from '../../stores/contextStore';
import { useSettings } from '../../stores/settingsStore';
import { useItemStore } from '../../stores/itemStore';
import { ChatMessage } from '../../types/ai';
import { formatTaskBatchSource } from '../../types/item';
import { StructuredTaskItem, extractStructuredTasks } from '../../services/ai/taskExtractor';
import { TaskExtractionModal } from '../tasks/TaskExtractionModal';
import { MarkdownViewer } from '../common/MarkdownViewer';
import { db } from '../../services/database';
import { getLlmProviderConfig, getProviderDisplayName } from '../../utils/aiUtils';

interface LandingHeroAiChatProps {
  onArtifactCreated?: (msg: string) => void;
  onOpenSettings?: () => void;
}

const SMART_PROMPT_CHIPS = [
  {
    icon: '📅',
    label: 'What are my top priorities today?',
    prompt: 'What are my highest priority tasks today based on items in Velco? Give me a recommended execution order.',
  },
  {
    icon: '📊',
    label: 'Summarize recent notes & progress',
    prompt: 'Please draft an executive summary of my recent notes, updates, and progress stored here.',
  },
  {
    icon: '💡',
    label: 'Brainstorm active project ideas',
    prompt: 'Help me brainstorm 3-5 breakthrough ideas or next steps to advance my active projects.',
  },
  {
    icon: '🔍',
    label: 'Analyze blockers & find solutions',
    prompt: 'Based on available context, analyze potential issues or bottlenecks and provide step-by-step solutions.',
  },
];

export const LandingHeroAiChat: React.FC<LandingHeroAiChatProps> = ({
  onArtifactCreated,
  onOpenSettings,
}) => {
  const { stagedItems, totalTokens } = useContextStore();
  const { settings } = useSettings();
  const {
    messages,
    isGenerating,
    sendMessage,
    stopGenerating,
    clearChat,
  } = useChatStore();

  const [prompt, setPrompt] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [extractingMsgId, setExtractingMsgId] = useState<string | null>(null);
  const [savedBatchMsgId, setSavedBatchMsgId] = useState<string | null>(null);
  const [extractedTasks, setExtractedTasks] = useState<StructuredTaskItem[]>([]);
  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
  const [extractBatchTitle, setExtractBatchTitle] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const providerInfo = getProviderDisplayName(settings);
  const tokens = totalTokens();

  const handleSend = async (overridePrompt?: string) => {
    const textToSend = (overridePrompt ?? prompt).trim();
    if (!textToSend || isGenerating) return;

    setPrompt('');
    const config = getLlmProviderConfig(settings);
    await sendMessage(textToSend, stagedItems, config);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveAsNote = async (msg: ChatMessage) => {
    if (!msg.content.trim()) return;
    try {
      const cleanText = msg.content.replace(/^[#\s*>-]+/, '').trim();
      const firstLine = cleanText.split('\n')[0] || 'AI Note';
      const title = firstLine.slice(0, 60) + (firstLine.length > 60 ? '...' : '');

      await db.createItem({
        type: 'note',
        title: `AI Note: ${title}`,
        content: msg.content,
        source: 'landing_ai_chat',
      });

      setSavedNoteId(msg.id);
      setTimeout(() => setSavedNoteId(null), 2500);

      if (onArtifactCreated) {
        onArtifactCreated(`Saved note: "${title}"`);
      }
    } catch (err: any) {
      console.error('Failed to save note from chat:', err);
    }
  };

  const handleStartTaskExtraction = async (msg: ChatMessage) => {
    if (!msg.content.trim() || extractingMsgId) return;
    try {
      setExtractingMsgId(msg.id);
      const llmConfig = getLlmProviderConfig(settings);
      const model = llmConfig.config.model;
      const baseUrl = llmConfig.config.base_url;
      const apiKey = (llmConfig.config as any).api_key || '';

      const cleanText = msg.content.replace(/^[#\s*>-]+/, '').trim();
      const firstLine = cleanText.split('\n')[0] || 'AI Assistant Tasks';
      const batchTitle = firstLine.slice(0, 50) + (firstLine.length > 50 ? '...' : '');

      const tasks = await extractStructuredTasks(msg.content, model, baseUrl, apiKey);

      setExtractBatchTitle(batchTitle);
      setExtractedTasks(tasks);
      setIsExtractModalOpen(true);
    } catch (err: any) {
      console.error('Failed to extract tasks from chat:', err);
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
        onArtifactCreated(`Created ${tasksToCreate.length} task${tasksToCreate.length > 1 ? 's' : ''}: "${extractBatchTitle}"`);
      }
    } catch (err: any) {
      console.error('Failed to save extracted tasks from chat:', err);
    }
  };

  return (
    <div className="w-full min-w-0 bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-sm overflow-hidden flex flex-col transition-all">
      {/* Top Bar: Engine & Context Pill Header */}
      <div className="px-4 py-2.5 bg-slate-50/70 dark:bg-slate-950/60 border-b border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-3 h-3 animate-pulse" />
          </div>
          <span className="font-semibold text-slate-800 dark:text-slate-200 tracking-tight">
            Velco AI Assistant
          </span>

          <span className="text-slate-300 dark:text-slate-700">|</span>

          {/* Active Model Indicator */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
            {providerInfo.isLocal ? (
              <Cpu className="w-3 h-3 text-emerald-500 shrink-0" />
            ) : (
              <Globe className="w-3 h-3 text-blue-500 shrink-0" />
            )}
            <span className="truncate max-w-[140px] sm:max-w-[200px]">
              {providerInfo.providerName} &bull; {providerInfo.modelName}
            </span>
          </div>

          {/* Staged Context Items Badge */}
          {stagedItems.length > 0 && (
            <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono text-[11px]">
              <Layers className="w-3 h-3 text-indigo-500" />
              <span>{stagedItems.length} item ({tokens.toLocaleString()}t)</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              disabled={isGenerating}
              className="px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="Clear chat"
            >
              <Trash2 className="w-3 h-3" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Configure AI Provider"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Conversation Stream (Collapsible / Scrollable if messages exist) */}
      {messages.length > 0 && (
        <div className="p-4 space-y-4 max-h-[380px] overflow-y-auto overflow-x-hidden border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-950/20 w-full min-w-0">
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
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`flex flex-col max-w-[85%] min-w-0 ${
                    isUser ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`p-3.5 rounded-2xl leading-relaxed break-words overflow-hidden min-w-0 ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                        : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 rounded-bl-xs shadow-xs'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="prose prose-xs dark:prose-invert max-w-none">
                        <MarkdownViewer content={msg.content} />
                        {msg.isStreaming && (
                          <span className="inline-block w-1.5 h-3.5 bg-indigo-500 animate-pulse ml-1 align-middle" />
                        )}
                        {msg.error && (
                          <div className="mt-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 flex items-center gap-1.5 text-xs">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{msg.error}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actionable Artifact Buttons for Assistant Messages */}
                  {!isUser && !msg.isStreaming && msg.content.trim() && (
                    <div className="flex items-center gap-1.5 mt-1.5 ml-1 text-[11px] text-slate-400">
                      <button
                        onClick={() => handleSaveAsNote(msg)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                          isSavedNote
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 font-semibold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                        title="Save as Note in SQLite"
                      >
                        {isSavedNote ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>Saved!</span>
                          </>
                        ) : (
                          <>
                            <FileText className="w-3 h-3" />
                            <span>Save Note</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleStartTaskExtraction(msg)}
                        disabled={isExtracting}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                          isSavedBatch
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 font-semibold'
                            : isExtracting
                            ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-medium'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                        title="Analyze content and extract into structured tasks"
                      >
                        {isExtracting ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                            <span>Extracting...</span>
                          </>
                        ) : isSavedBatch ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>Tasks Created!</span>
                          </>
                        ) : (
                          <>
                            <ListTodo className="w-3 h-3 text-indigo-500" />
                            <span>Extract Tasks</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
                        title="Copy response"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Smart Prompt Chips (Only shown on clean initial state before user types or sends a prompt) */}
      {messages.length === 0 && !prompt.trim() && (
        <div className="px-4 pt-2.5 pb-1 transition-all duration-200">
          <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
            <span>Suggested Prompts</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SMART_PROMPT_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(chip.prompt)}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100/70 hover:bg-indigo-50 dark:bg-slate-800/60 dark:hover:bg-indigo-950/50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200/60 dark:border-slate-700/60 hover:border-indigo-300 dark:hover:border-indigo-700 text-xs transition-all cursor-pointer shadow-2xs group text-left disabled:opacity-50 max-w-full min-w-0"
              >
                <span className="text-xs shrink-0 group-hover:scale-110 transition-transform">
                  {chip.icon}
                </span>
                <span className="font-medium truncate max-w-[200px] sm:max-w-[280px]">
                  {chip.label}
                </span>
                <ArrowRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prompt Input Dock */}
      <div className="p-3.5">
        <div className="relative flex items-center gap-2 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-inner">
          <textarea
            ref={textareaRef}
            rows={1}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isGenerating
                ? 'AI is generating response...'
                : 'Ask anything, analyze notes, or schedule tasks... (Enter to send)'
            }
            disabled={isGenerating}
            className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none resize-none text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 py-1.5 px-2.5 leading-relaxed max-h-32 min-h-[34px]"
          />

          <div className="flex items-center gap-1.5 shrink-0 pr-1">
            {isGenerating ? (
              <button
                onClick={stopGenerating}
                className="px-2.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer animate-pulse"
                title="Stop generating response"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span className="hidden sm:inline">Stop</span>
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!prompt.trim()}
                className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
                title="Send (Enter)"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Warning if Cloud Provider configured without API Key */}
        {!providerInfo.isLocal && !providerInfo.hasKey && (
          <div className="mt-2 flex items-center justify-between text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-900">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>API key for {providerInfo.providerName} is not configured.</span>
            </div>
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="underline font-semibold hover:text-amber-800 dark:hover:text-amber-200 cursor-pointer"
              >
                Configure now
              </button>
            )}
          </div>
        )}
      </div>

      {/* Structured Task Extraction Review Modal */}
      <TaskExtractionModal
        isOpen={isExtractModalOpen}
        onClose={() => setIsExtractModalOpen(false)}
        tasks={extractedTasks}
        sourceTitle={extractBatchTitle || 'AI Assistant'}
        onConfirm={handleConfirmExtractTasks}
      />
    </div>
  );
};
