import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useContextStore } from '../../stores/contextStore';
import { useSettings } from '../../stores/settingsStore';
import { useItemStore } from '../../stores/itemStore';
import { getLlmProviderConfig } from '../../utils/aiUtils';
import { db } from '../../services/database';
import { formatTaskBatchSource } from '../../types/item';
import {
  StructuredTaskItem,
  extractStructuredTasks,
  generateCleanBatchTitle,
  smartHeuristicTaskExtraction,
} from '../../services/ai/taskExtractor';
import { TaskExtractionModal } from '../../components/tasks/TaskExtractionModal';
import { PlaygroundHeader } from './PlaygroundHeader';
import { PlaygroundEmptyState } from './PlaygroundEmptyState';
import { PlaygroundMessageItem } from './PlaygroundMessageItem';
import { PlaygroundInputDock } from './PlaygroundInputDock';

interface PlaygroundViewProps {
  onOpenSettings?: () => void;
  onArtifactCreated?: (msg: string) => void;
}

export const PlaygroundView: React.FC<PlaygroundViewProps> = ({
  onOpenSettings,
  onArtifactCreated,
}) => {
  const { messages, isGenerating, sendMessage, stopGenerating, clearChat, deleteMessage } =
    useChatStore();
  const { chatContextItems } = useContextStore();
  const { settings } = useSettings();

  const [prompt, setPrompt] = useState('');
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Message Action Feedback States
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [extractingMsgId, setExtractingMsgId] = useState<string | null>(null);
  const [savedBatchMsgId, setSavedBatchMsgId] = useState<string | null>(null);

  // Task Extraction Modal States
  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState<StructuredTaskItem[]>([]);
  const [extractBatchTitle, setExtractBatchTitle] = useState<string>('');

  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef(false);

  // Scroll detection to respect user's manual scroll position
  const handleScroll = () => {
    if (!messagesScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesScrollRef.current;
    // Consider scrolled up if user is more than 100px from bottom
    const isUp = scrollHeight - (scrollTop + clientHeight) > 100;
    isUserScrolledUpRef.current = isUp;
    setShowScrollBottom(isUp);
  };

  const scrollToBottom = useCallback(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottom(false);
    isUserScrolledUpRef.current = false;
  }, []);

  // Auto-scroll to bottom when new messages arrive or while streaming
  useEffect(() => {
    if (!isUserScrolledUpRef.current && bottomAnchorRef.current) {
      bottomAnchorRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isGenerating]);

  // Send Message Handler
  const handleSend = useCallback(
    (textToSend?: string) => {
      const content = (textToSend || prompt).trim();
      if (!content || isGenerating || !settings.aiEnabled) return;

      const config = getLlmProviderConfig(settings);
      sendMessage(content, chatContextItems, config);
      setPrompt('');
      isUserScrolledUpRef.current = false;

      // Ensure view scrolls to bottom on user send
      setTimeout(() => {
        bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    },
    [prompt, isGenerating, settings, chatContextItems, sendMessage]
  );

  // New Chat Handler
  const handleNewChat = useCallback(() => {
    if (isGenerating) return;
    clearChat();
    setPrompt('');
    isUserScrolledUpRef.current = false;
  }, [isGenerating, clearChat]);

  // Copy Message Handler
  const handleCopyMessage = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Save Assistant Response as SQLite Note
  const handleSaveToNote = useCallback(
    async (msgId: string, content: string) => {
      try {
        const title = content.slice(0, 60).trim() || 'Playground Note';
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
    },
    [onArtifactCreated]
  );

  // Extract Actionable Tasks from Assistant Message
  const handleExtractTasksFromMessage = useCallback(
    async (msg: { id: string; content: string }) => {
      setExtractingMsgId(msg.id);
      try {
        const generatedTitle = generateCleanBatchTitle(msg.content, 'Playground Action Items');
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
      } catch (err) {
        const fallback = smartHeuristicTaskExtraction(msg.content);
        if (fallback.length > 0) {
          setExtractedTasks(fallback);
          setIsExtractModalOpen(true);
        }
      } finally {
        setExtractingMsgId(null);
      }
    },
    [settings]
  );

  // Confirm Saving Extracted Tasks to SQLite
  const handleConfirmExtractTasks = useCallback(
    async (tasksToCreate: StructuredTaskItem[]) => {
      if (tasksToCreate.length === 0) return;
      try {
        const batchId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const batchSourceStr = formatTaskBatchSource({
          origin: 'ai_chat',
          batchId,
          batchTitle: extractBatchTitle || 'Playground Tasks',
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
          onArtifactCreated(
            `Created ${tasksToCreate.length} task${tasksToCreate.length > 1 ? 's' : ''}`
          );
        }
      } catch (err) {
        console.error('Failed to save extracted tasks from playground:', err);
      }
    },
    [extractBatchTitle, extractingMsgId, onArtifactCreated]
  );

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden bg-slate-50/50 dark:bg-[#09090b] select-none">
      {/* 1. Dedicated Top Chat Navigation Bar */}
      <PlaygroundHeader
        onNewChat={handleNewChat}
        onClearChat={clearChat}
        isGenerating={isGenerating}
        hasMessages={messages.length > 0}
        contextCount={chatContextItems.length}
      />

      {/* 2. Scrollable Messages Viewport */}
      <div className="relative flex-1 min-h-0 overflow-hidden flex flex-col">
        <div
          ref={messagesScrollRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        >
          {messages.length === 0 ? (
            <div className="p-4 sm:p-6">
              <PlaygroundEmptyState
                onSelectPrompt={(text) => handleSend(text)}
                disabled={isGenerating}
              />
            </div>
          ) : (
            <div className="max-w-3xl xl:max-w-4xl mx-auto w-full space-y-6 px-4 sm:px-6 pt-4 pb-6">
              {messages.map((msg) => (
                <PlaygroundMessageItem
                  key={msg.id}
                  msg={msg}
                  onCopy={handleCopyMessage}
                  isCopied={copiedId === msg.id}
                  onSaveToNote={handleSaveToNote}
                  isSavedNote={savedNoteId === msg.id}
                  onExtractTasks={handleExtractTasksFromMessage}
                  isExtracting={extractingMsgId === msg.id}
                  isSavedBatch={savedBatchMsgId === msg.id}
                  onDelete={deleteMessage}
                />
              ))}
              <div ref={bottomAnchorRef} className="h-2" />
            </div>
          )}
        </div>

        {/* Floating Jump to Latest Button (Small, Centered, Minimalist) */}
        {showScrollBottom && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <button
              type="button"
              onClick={scrollToBottom}
              className="w-8 h-8 rounded-full bg-slate-900/90 hover:bg-slate-900 text-white dark:bg-[#18181d]/95 dark:hover:bg-[#22222a] shadow-xl backdrop-blur-md border border-slate-700/60 dark:border-white/[0.15] flex items-center justify-center transition-all active:scale-90 hover:scale-105 cursor-pointer group select-none relative"
              title="Scroll to latest message"
              aria-label="Scroll to latest message"
            >
              <ChevronDown className="w-4 h-4 stroke-[2.5] text-slate-300 group-hover:text-white group-hover:translate-y-0.5 transition-transform" />
              {isGenerating && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-slate-900 dark:ring-[#18181d] animate-pulse" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* 3. Floating Bottom Input Dock */}
      <PlaygroundInputDock
        prompt={prompt}
        onPromptChange={setPrompt}
        onSend={() => handleSend()}
        onStop={stopGenerating}
        isGenerating={isGenerating}
      />

      {/* 4. Task Extraction Modal Dialog */}
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
