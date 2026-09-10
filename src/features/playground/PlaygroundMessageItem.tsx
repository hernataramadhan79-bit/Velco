import React from 'react';
import {
  Bot,
  User,
  Copy,
  Check,
  FileText,
  ListTodo,
  Trash2,
  Loader2,
  AlertCircle,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ChatMessage } from '../../types/ai';
import { MarkdownViewer } from '../../components/common/MarkdownViewer';

interface PlaygroundMessageItemProps {
  msg: ChatMessage;
  onCopy: (id: string, text: string) => void;
  isCopied: boolean;
  onSaveToNote: (id: string, content: string) => Promise<void>;
  isSavedNote: boolean;
  onExtractTasks: (msg: { id: string; content: string }) => Promise<void>;
  isExtracting: boolean;
  isSavedBatch: boolean;
  onDelete: (id: string) => void;
}

export const PlaygroundMessageItem: React.FC<PlaygroundMessageItemProps> = ({
  msg,
  onCopy,
  isCopied,
  onSaveToNote,
  isSavedNote,
  onExtractTasks,
  isExtracting,
  isSavedBatch,
  onDelete,
}) => {
  const isUser = msg.role === 'user';

  return (
    <div
      className={`w-full flex gap-3.5 group select-text ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Bot Avatar (Assistant Only) */}
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
          <Bot className="w-4 h-4 stroke-[1.75]" />
        </div>
      )}

      {/* Message Content Container */}
      <div
        className={`flex flex-col min-w-0 ${
          isUser ? 'items-end max-w-[85%] sm:max-w-[78%]' : 'items-start flex-1 max-w-full'
        }`}
      >
        {/* Attached Context Pills on User Prompts */}
        {isUser && msg.stagedItemTitles && msg.stagedItemTitles.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-1.5 mb-1.5 select-none">
            <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 flex items-center gap-1">
              <Layers className="w-3 h-3 text-blue-500" />
              Attached:
            </span>
            {msg.stagedItemTitles.map((title, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-white/[0.06] border border-slate-300/80 dark:border-white/[0.08] text-[10px] font-mono text-slate-700 dark:text-zinc-300 truncate max-w-[160px]"
                title={title}
              >
                {title}
              </span>
            ))}
          </div>
        )}

        {/* Message Bubble / Markdown Card */}
        <div
          className={`w-full text-sm leading-relaxed ${
            isUser
              ? 'overflow-hidden bg-slate-900 text-white dark:bg-[#18181c] dark:text-zinc-100 rounded-2xl rounded-tr-xs px-4 py-3 shadow-xs border border-slate-800 dark:border-white/[0.09]'
              : 'text-slate-800 dark:text-zinc-200 py-1 min-w-0'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          ) : (
            <div className="space-y-2">
              {/* Streaming or Empty Content */}
              {msg.isStreaming && !msg.content ? (
                <div className="flex items-center gap-2 text-slate-400 dark:text-zinc-500 font-mono text-xs py-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                  <span>Generating response...</span>
                </div>
              ) : (
                <div className="prose prose-slate dark:prose-invert max-w-none text-sm text-slate-800 dark:text-zinc-200">
                  <MarkdownViewer content={msg.content} />
                </div>
              )}

              {/* Streaming Cursor Pulse */}
              {msg.isStreaming && msg.content && (
                <span className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse align-middle rounded-xs" />
              )}

              {/* Error Callout */}
              {msg.error && (
                <div className="mt-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1 break-words">
                    <span className="font-semibold">Generation Error: </span>
                    {msg.error}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Bar (Assistant Only, appears cleanly beneath text) */}
        {!isUser && !msg.isStreaming && msg.content && (
          <div className="flex items-center gap-1.5 mt-2 text-xs select-none">
            {/* Copy Button */}
            <button
              onClick={() => onCopy(msg.id, msg.content)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-white/[0.05] transition-colors cursor-pointer text-[11px] font-mono"
              title="Copy response to clipboard"
            >
              {isCopied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[2]" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 stroke-[1.5]" />
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* Save as Note Button */}
            <button
              onClick={() => onSaveToNote(msg.id, msg.content)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer ${
                isSavedNote
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-white/[0.05]'
              }`}
              title="Save message as a permanent Note in SQLite"
            >
              <FileText className="w-3 h-3 stroke-[1.5]" />
              <span>{isSavedNote ? 'Saved Note' : 'Save to Notes'}</span>
            </button>

            {/* Extract Actionable Tasks Button */}
            <button
              onClick={() => onExtractTasks(msg)}
              disabled={isExtracting}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer ${
                isSavedBatch
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-white/[0.05]'
              }`}
              title="Extract structured action items from this response"
            >
              {isExtracting ? (
                <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
              ) : (
                <ListTodo className="w-3 h-3 stroke-[1.5]" />
              )}
              <span>{isSavedBatch ? 'Extracted' : 'Extract Tasks'}</span>
            </button>

            {/* Delete Single Message */}
            <button
              onClick={() => onDelete(msg.id)}
              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:text-zinc-500 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 transition-colors cursor-pointer ml-1"
              title="Delete this message"
            >
              <Trash2 className="w-3 h-3 stroke-[1.5]" />
            </button>
          </div>
        )}
      </div>

      {/* User Avatar (User Only) */}
      {isUser && (
        <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-white/[0.08] text-slate-700 dark:text-zinc-200 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs select-none">
          <User className="w-4 h-4 stroke-[1.75]" />
        </div>
      )}
    </div>
  );
};
