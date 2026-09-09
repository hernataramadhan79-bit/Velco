import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Square,
  CornerDownLeft,
  Paperclip,
  X,
  Search,
  Layers,
  FileText,
  CheckSquare,
  FileCode,
  Globe,
  Loader2,
  Check,
} from 'lucide-react';
import { useSettings } from '../../stores/settingsStore';
import { useContextStore, StagedItem, itemToStagedItem } from '../../stores/contextStore';
import { db } from '../../services/database';
import { Item } from '../../types/item';

interface PlaygroundInputDockProps {
  prompt: string;
  onPromptChange: (val: string) => void;
  onSend: () => void;
  onStop: () => void;
  isGenerating: boolean;
}

export const PlaygroundInputDock: React.FC<PlaygroundInputDockProps> = ({
  prompt,
  onPromptChange,
  onSend,
  onStop,
  isGenerating,
}) => {
  const { settings } = useSettings();
  const {
    chatContextItems,
    addChatContextItem,
    addChatContextItems,
    removeChatContextItem,
    clearChatContext,
    totalChatTokens,
  } = useContextStore();

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerTab, setPickerTab] = useState<'all' | 'note' | 'task' | 'file' | 'link'>('all');
  const [workspaceItems, setWorkspaceItems] = useState<Item[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const chatTokens = totalChatTokens();

  // Load all workspace items directly from SQLite (bypassing view/tag restrictions)
  const loadWorkspaceItems = useCallback(async () => {
    setIsLoadingItems(true);
    try {
      const items = await db.getItems({ includeTrash: false, includeArchived: false });
      setWorkspaceItems(items);
    } catch (err) {
      console.error('Failed to load workspace items for context picker:', err);
    } finally {
      setIsLoadingItems(false);
    }
  }, []);

  // Initial load and reload when picker opens
  useEffect(() => {
    void loadWorkspaceItems();
  }, [loadWorkspaceItems]);

  useEffect(() => {
    if (isPickerOpen) {
      void loadWorkspaceItems();
    }
  }, [isPickerOpen, loadWorkspaceItems]);

  // Close context picker on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsPickerOpen(false);
      }
    };
    if (isPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isPickerOpen]);

  // Adjust textarea height on prompt change
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
    }
  }, [prompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && prompt.trim() && settings.aiEnabled) {
        onSend();
      }
    }
  };

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case 'note':
      case 'text':
        return <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
      case 'task':
        return <CheckSquare className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
      case 'file':
      case 'image':
      case 'audio':
        return <FileCode className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      case 'link':
        return <Globe className="w-3.5 h-3.5 text-purple-500 shrink-0" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    }
  };

  // Dynamic category counters for all non-trashed workspace items
  const categoryCounts = useMemo(() => {
    let note = 0;
    let task = 0;
    let file = 0;
    let link = 0;

    for (const item of workspaceItems) {
      if (item.type === 'note' || item.type === 'text') note++;
      else if (item.type === 'task') task++;
      else if (item.type === 'link') link++;
      else if (
        item.type === 'file' ||
        item.type === 'image' ||
        item.type === 'audio' ||
        (item.attachments && item.attachments.length > 0)
      ) {
        file++;
      } else {
        note++;
      }
    }

    return {
      all: workspaceItems.length,
      note,
      task,
      file,
      link,
    };
  }, [workspaceItems]);

  // Full filtered list - NO hardcoded slicing, shows all matching database items
  const filteredItems = useMemo(() => {
    return workspaceItems.filter((item) => {
      if (pickerTab === 'note' && item.type !== 'note' && item.type !== 'text') return false;
      if (pickerTab === 'task' && item.type !== 'task') return false;
      if (pickerTab === 'link' && item.type !== 'link') return false;
      if (
        pickerTab === 'file' &&
        item.type !== 'file' &&
        item.type !== 'image' &&
        item.type !== 'audio' &&
        (!item.attachments || item.attachments.length === 0)
      ) {
        return false;
      }

      if (!pickerSearch.trim()) return true;
      const q = pickerSearch.toLowerCase();
      const titleMatch = (item.title || '').toLowerCase().includes(q);
      const contentMatch = (item.content || '').toLowerCase().includes(q);
      const tagMatch = (item.tags || []).some((t) => t.name.toLowerCase().includes(q));
      const linkMatch =
        item.link?.url?.toLowerCase().includes(q) ||
        item.link?.domain?.toLowerCase().includes(q);
      const fileMatch = (item.attachments || []).some((a) =>
        a.fileName.toLowerCase().includes(q)
      );
      return titleMatch || contentMatch || tagMatch || linkMatch || fileMatch;
    });
  }, [workspaceItems, pickerTab, pickerSearch]);

  const allVisibleAttached =
    filteredItems.length > 0 &&
    filteredItems.every((item) => chatContextItems.some((c) => c.id === item.id));

  const handleToggleAllVisible = () => {
    if (allVisibleAttached) {
      filteredItems.forEach((item) => removeChatContextItem(item.id));
    } else {
      const toAdd = filteredItems
        .filter((item) => !chatContextItems.some((c) => c.id === item.id))
        .map(itemToStagedItem);
      addChatContextItems(toAdd);
    }
  };

  return (
    <div className="relative w-full shrink-0 select-none">
      {/* Soft gradient blur edge behind input dock */}
      <div className="pointer-events-none absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-slate-50 dark:from-[#09090b] to-transparent z-10" />

      <div className="max-w-3xl xl:max-w-4xl mx-auto px-4 pb-4 pt-1 flex flex-col relative z-20">
        {/* Attached Context Tray (Sleek Pills Strip) */}
        {chatContextItems.length > 0 && (
          <div className="mb-2 px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-[#141418]/90 border border-slate-200/80 dark:border-white/[0.08] backdrop-blur-md flex flex-wrap items-center gap-1.5 text-xs shadow-2xs">
            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-zinc-400 mr-1">
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              <span className="font-semibold">Context ({chatContextItems.length}):</span>
            </div>

            {chatContextItems.map((item) => (
              <div
                key={item.id}
                className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-0.5 rounded-lg bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] text-[11px] font-mono text-slate-700 dark:text-zinc-300 shadow-2xs group"
              >
                {getItemTypeIcon(item.type)}
                <span className="truncate max-w-[140px]">{item.title}</span>
                <button
                  type="button"
                  onClick={() => removeChatContextItem(item.id)}
                  className="p-0.5 rounded text-slate-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-white/[0.1] transition-colors cursor-pointer"
                  title="Remove from context"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            <div className="ml-auto flex items-center gap-2">
              <span className="font-mono text-[10px] text-slate-400 dark:text-zinc-500">
                {chatTokens.toLocaleString()} tokens
              </span>
              <button
                type="button"
                onClick={clearChatContext}
                className="text-[10px] font-mono text-slate-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400 hover:underline cursor-pointer"
              >
                Clear all
              </button>
            </div>
          </div>
        )}

        {/* Input Card */}
        <div
          className={`relative w-full rounded-2xl bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.1] focus-within:border-blue-500/60 dark:focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/10 shadow-lg dark:shadow-2xl transition-all p-2.5 sm:p-3 flex flex-col gap-2 ${
            !settings.aiEnabled ? 'opacity-60 cursor-not-allowed' : ''
          }`}
        >
          {/* Inline Context Picker Popover Dialog */}
          {isPickerOpen && (
            <div
              ref={pickerRef}
              className="absolute bottom-full left-0 sm:left-2 right-0 sm:right-auto sm:w-[460px] mb-2 p-3.5 bg-white dark:bg-[#18181d] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/[0.12] z-40 text-xs space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150"
            >
              {/* Popover Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Paperclip className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-zinc-200 text-xs leading-none">
                      Attach Workspace Context
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 mt-0.5 inline-block">
                      {isLoadingItems ? 'Loading items...' : `${workspaceItems.length} items in database`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {isLoadingItems && (
                    <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin mr-1" />
                  )}
                  <button
                    type="button"
                    onClick={() => setIsPickerOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search all notes, tasks, files, links by title, content, or #tag..."
                  className="w-full bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
                {pickerSearch && (
                  <button
                    type="button"
                    onClick={() => setPickerSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Category Filter Tabs with dynamic SQLite counts */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] font-mono no-scrollbar">
                {(
                  [
                    { id: 'all', label: 'All', count: categoryCounts.all },
                    { id: 'note', label: 'Notes', count: categoryCounts.note },
                    { id: 'task', label: 'Tasks', count: categoryCounts.task },
                    { id: 'file', label: 'Files', count: categoryCounts.file },
                    { id: 'link', label: 'Links', count: categoryCounts.link },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPickerTab(tab.id)}
                    className={`px-2 py-1 rounded-lg tracking-tight cursor-pointer transition-colors shrink-0 flex items-center gap-1 ${
                      pickerTab === tab.id
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 font-semibold shadow-2xs'
                        : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded-full ${
                        pickerTab === tab.id
                          ? 'bg-blue-200/70 text-blue-800 dark:bg-blue-500/30 dark:text-blue-200'
                          : 'bg-slate-200/60 dark:bg-white/[0.06] text-slate-400 dark:text-zinc-500'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Quick Action Sub-bar */}
              {filteredItems.length > 0 && (
                <div className="flex items-center justify-between pt-0.5 text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                  <span>
                    Showing {filteredItems.length} of {workspaceItems.length}
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleAllVisible}
                    className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {allVisibleAttached ? 'Deselect all visible' : 'Select all visible'}
                  </button>
                </div>
              )}

              {/* Items List (Smoothly scrollable, NO hardcoded limits) */}
              <div className="max-h-64 overflow-y-auto space-y-1 pr-1 overscroll-contain">
                {isLoadingItems && workspaceItems.length === 0 ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-zinc-500 text-xs">
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    <span>Loading workspace items from SQLite...</span>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
                    {pickerSearch
                      ? `No items match "${pickerSearch}"`
                      : 'No items in this category yet'}
                  </div>
                ) : (
                  filteredItems.map((item) => {
                    const isAttached = chatContextItems.some((c) => c.id === item.id);
                    const excerpt = item.content
                      ? item.content.slice(0, 85).replace(/\s+/g, ' ')
                      : item.link?.url || item.attachments?.[0]?.fileName || '';

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (isAttached) {
                            removeChatContextItem(item.id);
                          } else {
                            addChatContextItem(itemToStagedItem(item));
                          }
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-all cursor-pointer text-left group ${
                          isAttached
                            ? 'bg-blue-50 text-blue-900 border border-blue-200/80 dark:bg-blue-500/15 dark:text-blue-200 dark:border-blue-500/30'
                            : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.04] border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] shrink-0">
                            {getItemTypeIcon(item.type)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-medium text-slate-900 dark:text-zinc-100">
                                {item.title || 'Untitled'}
                              </span>
                              {item.tags && item.tags.length > 0 && (
                                <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 shrink-0">
                                  #{item.tags[0].name}
                                </span>
                              )}
                            </div>
                            {excerpt && (
                              <p className="truncate text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                {excerpt}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isAttached ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-600 text-white font-semibold shadow-2xs">
                              <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                              Attached
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-zinc-400 uppercase">
                              {item.type}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Dynamic Auto-Expanding Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!settings.aiEnabled}
            placeholder={
              settings.aiEnabled
                ? "Message AI... (Enter to send, Shift+Enter for newline)"
                : "AI engine is disabled in Settings..."
            }
            className="w-full bg-transparent border-none outline-none resize-none text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 min-h-[42px] max-h-56 py-1 px-1 leading-relaxed disabled:cursor-not-allowed select-text"
          />

          {/* Bottom Toolbar inside Card */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/[0.05] text-xs">
            {/* Left Controls: Attach Context Button */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => settings.aiEnabled && setIsPickerOpen(!isPickerOpen)}
                disabled={!settings.aiEnabled}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isPickerOpen || chatContextItems.length > 0
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                    : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.05]'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
                title="Attach context from SQLite database"
              >
                <Paperclip className="w-3.5 h-3.5 stroke-[1.75]" />
                <span className="hidden sm:inline">Attach</span>
                {chatContextItems.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-mono font-bold">
                    {chatContextItems.length}
                  </span>
                )}
              </button>
            </div>

            {/* Right Controls: Send / Stop Button */}
            <div className="flex items-center gap-2">
              {isGenerating ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-medium text-xs transition-colors cursor-pointer shadow-xs"
                  title="Stop generation"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSend}
                  disabled={!prompt.trim() || !settings.aiEnabled}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-zinc-200 font-semibold text-xs transition-all cursor-pointer shadow-xs disabled:opacity-30 disabled:pointer-events-none"
                  title="Send message (Enter)"
                >
                  <CornerDownLeft className="w-3.5 h-3.5 stroke-[2]" />
                  <span>Send</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
