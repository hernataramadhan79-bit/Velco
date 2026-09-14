import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  KeyboardEvent,
} from 'react';
import { Plus, Search, Trash2, Edit2, Check, X, MessageSquare, Inbox } from 'lucide-react';
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
  today: 'Hari ini',
  yesterday: 'Kemarin',
  week: '7 Hari Terakhir',
  older: 'Lebih Lama',
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

// ─── Confirm inline delete ────────────────────────────────────────────────────

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

  return (
    <div
      onClick={() => !isEditing && onSelect()}
      className={`group relative flex flex-col gap-0.5 px-3 py-2 rounded-md cursor-pointer transition-colors select-none ${
        isActive
          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
          : 'hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-700 dark:text-zinc-300'
      }`}
    >
      {isEditing ? (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            className="flex-1 text-xs bg-white dark:bg-zinc-800 border border-blue-400 dark:border-blue-500 rounded px-1.5 py-0.5 outline-none"
            autoFocus
          />
          <button
            onClick={handleConfirmRename}
            className="p-0.5 rounded text-blue-500 hover:text-blue-600 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIsEditing(false); }}
            className="p-0.5 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-medium truncate flex-1">{session.title}</span>
            {session.origin === 'inbox' && (
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-500 dark:text-violet-400 border border-violet-400/20">
                Inbox
              </span>
            )}
          </div>
          {session.last_message_preview && (
            <span className="text-[11px] text-slate-400 dark:text-zinc-500 truncate leading-none">
              {session.last_message_preview}
            </span>
          )}
        </>
      )}

      {/* Action buttons — visible on hover */}
      {!isEditing && !isConfirmingDelete && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
          <button
            onClick={handleStartEdit}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer"
            title="Rename"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={handleDeleteClick}
            className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Confirm delete inline */}
      {isConfirmingDelete && (
        <div
          className="absolute inset-0 rounded-md flex items-center justify-between px-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
            Hapus sesi ini?
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleConfirmDelete}
              className="text-xs px-2 py-0.5 rounded bg-rose-500 text-white hover:bg-rose-600 cursor-pointer font-medium"
            >
              Hapus
            </button>
            <button
              onClick={handleCancelDelete}
              className="text-xs px-2 py-0.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}
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
  const activeTitle = activeSession?.title ?? 'Playground';
  const truncatedTitle =
    activeTitle.length > 28 ? activeTitle.slice(0, 28) + '…' : activeTitle;

  // Close on click-outside
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

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  // Focus search when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 50);
      setSearchQuery('');
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.last_message_preview ?? '').toLowerCase().includes(q)
    );
  }, [sessions, searchQuery]);

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
    <div className="relative">
      {/* Trigger button — judul sesi aktif */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer max-w-[200px]"
        title="History obrolan"
      >
        <MessageSquare className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-zinc-500" />
        <span className="text-xs font-medium truncate">{truncatedTitle}</span>
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full mt-1.5 w-72 z-50 rounded-lg bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.08] shadow-xl shadow-black/10 dark:shadow-black/40 flex flex-col overflow-hidden"
          style={{ maxHeight: '420px' }}
        >
          {/* New Chat button — fixed at top */}
          <div className="px-2 pt-2 pb-1.5 border-b border-slate-100 dark:border-white/[0.05]">
            <button
              onClick={handleNewSession}
              disabled={isGenerating}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-blue-500/10 hover:bg-blue-500/15 text-blue-600 dark:text-blue-400 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              Obrolan Baru
            </button>
          </div>

          {/* Search */}
          <div className="px-2 py-1.5 border-b border-slate-100 dark:border-white/[0.05]">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.07]">
              <Search className="w-3 h-3 text-slate-400 dark:text-zinc-500 shrink-0" />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari obrolan…"
                className="flex-1 text-xs bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600 text-slate-700 dark:text-zinc-300"
              />
            </div>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-slate-400 dark:text-zinc-600">
                Tidak ada obrolan ditemukan
              </div>
            ) : (
              GROUP_ORDER.filter((g) => grouped[g]?.length > 0).map((group) => (
                <div key={group}>
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-600">
                    {GROUP_LABELS[group]}
                  </div>
                  <div className="px-1">
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
