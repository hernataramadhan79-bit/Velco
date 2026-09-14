import React from 'react';
import {
  Sparkles,
  Bot,
  Tag as TagIcon,
  ListTodo,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { Item } from '../../../types/item';

interface ItemDetailAiTabProps {
  item: Item;
  aiEnabled: boolean;
  providerDisplayName: { providerName: string; modelName: string };
  isAiLoading: boolean;
  activeAiAction: string | null;
  aiError: string | null;
  chatMessages: { role: 'user' | 'assistant'; content: string; time: string }[];
  chatInput: string;
  onEnableAi: () => void;
  onRunAiAction: (action: 'summarize' | 'classify' | 'tags' | 'extract_tasks' | 'explain') => void;
  onChatInputChange: (val: string) => void;
  onSendChat: () => void;
}

export const ItemDetailAiTab: React.FC<ItemDetailAiTabProps> = ({
  item,
  aiEnabled,
  providerDisplayName,
  isAiLoading,
  activeAiAction,
  aiError,
  chatMessages,
  chatInput,
  onEnableAi,
  onRunAiAction,
  onChatInputChange,
  onSendChat,
}) => {
  if (!aiEnabled) {
    return (
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
          onClick={onEnableAi}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
        >
          Enable Local AI
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* AI Action Buttons */}
      <div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          Actions ({providerDisplayName.providerName})
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onRunAiAction('summarize')}
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
            onClick={() => onRunAiAction('classify')}
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
            onClick={() => onRunAiAction('tags')}
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
            onClick={() => onRunAiAction('extract_tasks')}
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
            onClick={() => onRunAiAction('explain')}
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

        <div className="p-3 max-h-48 overflow-y-auto overflow-x-hidden space-y-2 text-xs custom-scrollbar">
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
            onChange={(e) => onChatInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSendChat();
            }}
            placeholder="Ask a question..."
            disabled={isAiLoading}
            className="flex-1 px-3 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={onSendChat}
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
    </div>
  );
};
