import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  KeyboardEvent,
} from 'react';
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  Check,
  X,
  MessageSquare,
  ChevronDown,
} from 'lucide-react';
import { ChatSessionSummary } from '../../types/chat';

// ─── Date grouping helpers ────────────────────────────────────────────────────

function getDateGroup(updatedAt: number): 'today' | 'yesterday' | 'week' | 'older' {
  const now = Date.now();
  const diff = now - updatedAt;
  const DAY = 86_400_000;
  if (diff < DAY) return 'today';
  if (diff < 2 * DAY) return 'yesterday';
  if (diff < 7 * DAY) return 'week';
  return 'older';
}

const GROUP_LABELS: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'Previous 7 Days',
  older: 'Older',
};
const GROUP_ORDER = ['today', 'yesterday', 'week', 'older'] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionHistoryPopoverProps {
  sessions: ChatSessionSummary[];
  activeSessionId: string | null;
  onNewSession: () => void;
  onSwitchSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onDeleteSession: (id: string) => void;
  isGenerating: boolean;
}

// ─── Session Item ─────────────────────────────────────────────────────────────

interface SessionItemProps {
  session: ChatSessionSummary;
  isActive: boolean;
  onSelect: () => void;
  onRename: (newTitle: string) => void;
  onDelete: () => void;
}

const SessionItem: React.FC<SessionItemProps> = ({
  session,
  isActive,
  onSelect,
  onRename,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(session.title);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(session.title);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleConfirmRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== session.title) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  const handleRenameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleConfirmRename();
    if (e.key === 'Escape') setIsEditing(false);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfirmingDelete(true);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
    setIsConfirmingDelete(false);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfirmingDelete(false);
  };

  // 1. Mode Konfirmasi Hapus — Card Mandiri (Bebas Tabrakan & Tidak Tembus Pandang)
  if (isConfirmingDelete) {
    return (
      <div
        className="flex items-center justify-between gap-2 px-2.5 py-2 my-0.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 truncate">
          Delete this chat?
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleConfirmDelete}
            className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-medium cursor-pointer transition-colors shadow-2xs"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={handleCancelDelete}
            className="px-2 py-0.5 rounded text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-white/10 text-[11px] cursor-pointer transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // 2. Mode Edit / Rename Inline
  if (isEditing) {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 my-0.5 rounded-lg bg-slate-50 dark:bg-zinc-800/90 border border-blue-500/60 shadow-xs select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleRenameKeyDown}
          className="flex-1 text-xs bg-transparent border-none outline-none text-slate-900 dark:text-zinc-100 min-w-0 font-medium"
          autoFocus
        />
        <button
          type="button"
          onClick={handleConfirmRename}
          className="p-1 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-500/15 cursor-pointer shrink-0"
          title="Save"
        >
          <Check className="w-3.5 h-3.5 stroke-[2]" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(false);
          }}
          className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200/50 dark:hover:bg-white/10 cursor-pointer shrink-0"
          title="Cancel"
        >
          <X className="w-3.5 h-3.5 stroke-[2]" />
        </button>
      </div>
    );
  }

  // 3. Mode Tampilan Standar: Layout 2 Kolom Rapi (Badge berpindah ke Action Buttons saat hover tanpa tumpang-tindih)
  return (
    <div
      onClick={onSelect}
      className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all duration-150 select-none ${
        isActive
          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium'
          : 'hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-700 dark:text-zinc-300'
      }`}
    >
      {/* Kolom Kiri: Judul & Preview Teks */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-xs truncate ${
              isActive
                ? 'text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-slate-800 dark:text-zinc-200 group-hover:text-slate-900 dark:group-hover:text-zinc-100'
            }`}
          >
            {session.title}
          </span>
        </div>
        {session.last_message_preview && (
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate mt-0.5 leading-snug">
            {session.last_message_preview}
          </p>
        )}
      </div>

      {/* Kolom Kanan: Slot Tetap (Badge Inbox default, berganti tombol aksi saat Hover) */}
      <div className="shrink-0 flex items-center justify-end w-14">
        {/* Default Badge saat TIDAK di-hover */}
        <div className="flex items-center group-hover:hidden">
          {session.origin === 'inbox' && (
            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-500 dark:text-violet-400 border border-violet-400/20">
              Inbox
            </span>
          )}
        </div>

        {/* Action Buttons saat DI-HOVER (posisi tepat di slot kanan tanpa menabrak teks) */}
        <div className="hidden group-hover:flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleStartEdit}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Rename"
          >
            <Edit2 className="w-3 h-3 stroke-[1.5]" />
          </button>
          <button
            type="button"
            onClick={handleDeleteClick}
            className="p-1 rounded text-slate-400 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Delete chat"
          >
            <Trash2 className="w-3 h-3 stroke-[1.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Popover ─────────────────────────────────────────────────────────────

export const SessionHistoryPopover: React.FC<SessionHistoryPopoverProps> = ({
  sessions,
  activeSessionId,
  onNewSession,
  onSwitchSession,
  onRenameSession,
  onDeleteSession,
  isGenerating,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeTitle = activeSession?.title ?? 'New Chat';
  const truncatedTitle =
    activeTitle.length > 24 ? activeTitle.slice(0, 24) + '…' : activeTitle;

  // Filter out any ghost/empty sessions without messages
  const validSessions = useMemo(() => {
    return sessions.filter(
      (s) => s.message_count > 0 || (s.last_message_preview && s.last_message_preview.trim().length > 0)
    );
  }, [sessions]);

  // Tutup saat klik di luar popover
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  // Tutup dengan Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  // Auto focus input pencarian saat terbuka
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 40);
      setSearchQuery('');
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return validSessions;
    const q = searchQuery.toLowerCase();
    return validSessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.last_message_preview ?? '').toLowerCase().includes(q)
    );
  }, [validSessions, searchQuery]);

  const grouped = useMemo(() => {
    const map: Record<string, ChatSessionSummary[]> = {};
    for (const s of filtered) {
      const key = getDateGroup(s.updated_at);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return map;
  }, [filtered]);

  const handleSelect = useCallback(
    (id: string) => {
      onSwitchSession(id);
      setIsOpen(false);
    },
    [onSwitchSession]
  );

  const handleNewSession = useCallback(() => {
    onNewSession();
    setIsOpen(false);
  }, [onNewSession]);

  return (
    <div className="relative select-none">
      {/* Trigger button — judul sesi aktif + indikator dropdown */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer max-w-[220px] ${
          isOpen
            ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100'
            : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.05]'
        }`}
        title="Chat history"
      >
        <MessageSquare className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-zinc-500" />
        <span className="text-xs font-medium truncate">{truncatedTitle}</span>
        <ChevronDown
          className={`w-3 h-3 shrink-0 text-slate-400 dark:text-zinc-500 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-blue-500 dark:text-blue-400' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown — Ukuran Terukur (w-80 / 320px) Tidak Makan Tempat Tapi Pas */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full mt-1.5 w-80 z-50 rounded-xl bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.09] shadow-2xl shadow-black/20 dark:shadow-black/60 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{ maxHeight: '400px' }}
        >
          {/* Action Header: Tombol Obrolan Baru */}
          <div className="p-2 border-b border-slate-100 dark:border-white/[0.05]">
            <button
              type="button"
              onClick={handleNewSession}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/15 text-blue-600 dark:text-blue-400 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.25]" />
              <span>New Chat</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-2 py-1.5 border-b border-slate-100 dark:border-white/[0.05]">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06]">
              <Search className="w-3 h-3 text-slate-400 dark:text-zinc-500 shrink-0" />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="flex-1 text-xs bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600 text-slate-800 dark:text-zinc-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer p-0.5"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* List Sesi Obrolan dengan Scroll Halus */}
          <div className="flex-1 overflow-y-auto px-1.5 py-1 space-y-2">
            {filtered.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-slate-400 dark:text-zinc-500">
                {searchQuery ? 'No matching conversations' : 'No conversations yet'}
              </div>
            ) : (
              GROUP_ORDER.filter((g) => grouped[g]?.length > 0).map((group) => (
                <div key={group} className="space-y-0.5">
                  <div className="px-2.5 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    {GROUP_LABELS[group]}
                  </div>
                  <div className="space-y-0.5">
                    {grouped[group].map((session) => (
                      <SessionItem
                        key={session.id}
                        session={session}
                        isActive={session.id === activeSessionId}
                        onSelect={() => handleSelect(session.id)}
                        onRename={(newTitle) => onRenameSession(session.id, newTitle)}
                        onDelete={() => onDeleteSession(session.id)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
