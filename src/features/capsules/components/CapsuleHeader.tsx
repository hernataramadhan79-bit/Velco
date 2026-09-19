import React from 'react';
import {
  Share2,
  Trash2,
  WifiOff,
  Edit3,
  MoreVertical,
  Paperclip,
} from 'lucide-react';
import { Capsule, P2PStatus } from '../../../types/capsule';

interface CapsuleHeaderProps {
  activeCapsule: Capsule;
  tasksCount: number;
  docsCount: number;
  p2pStatus: P2PStatus | null;
  isP2PLoading: boolean;
  isOptionsMenuOpen: boolean;
  onToggleP2P: () => void;
  onOpenAttachModal: () => void;
  onOpenShareModal: () => void;
  onToggleOptionsMenu: () => void;
  onCloseOptionsMenu: () => void;
  onOpenEditModal: () => void;
  onDeleteCapsule: () => void;
}

export const CapsuleHeader: React.FC<CapsuleHeaderProps> = ({
  activeCapsule,
  tasksCount,
  docsCount,
  p2pStatus,
  isP2PLoading,
  isOptionsMenuOpen,
  onToggleP2P,
  onOpenAttachModal,
  onOpenShareModal,
  onToggleOptionsMenu,
  onCloseOptionsMenu,
  onOpenEditModal,
  onDeleteCapsule,
}) => {
  return (
    <div className="h-12 px-6 border-b border-slate-200 dark:border-white/[0.07] flex items-center justify-between gap-4 shrink-0 bg-white dark:bg-[#09090b]">
      {/* Title & Metadata */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate tracking-tight">
              {activeCapsule.name}
            </h2>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-zinc-300 font-semibold shrink-0">
              {activeCapsule.role}
            </span>
            <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
              {tasksCount} tasks &bull; {docsCount} notes
            </span>
          </div>
        </div>
      </div>

      {/* Actions Toolbar */}
      <div className="flex items-center gap-2 shrink-0">
        {/* LAN Live / P2P Toggle */}
        <button
          onClick={onToggleP2P}
          disabled={isP2PLoading}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer border ${
            p2pStatus?.is_active
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
              : 'bg-slate-100 dark:bg-white/[0.05] border-slate-200 dark:border-white/[0.07] text-slate-600 dark:text-zinc-300 hover:bg-slate-200/80 dark:hover:bg-white/[0.08]'
          }`}
          title={p2pStatus?.is_active ? 'Click to disconnect P2P session' : 'Go Live on local network'}
        >
          {p2pStatus?.is_active ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live ({p2pStatus.connected_peers.length} peers)</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-slate-400" />
              <span>{isP2PLoading ? 'Connecting...' : 'Go Live'}</span>
            </>
          )}
        </button>

        {/* Attach Existing Item from Workspace */}
        <button
          onClick={onOpenAttachModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200/80 dark:hover:bg-white/[0.08] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.07] text-xs font-medium transition-colors cursor-pointer"
          title="Attach notes or tasks from your workspace"
        >
          <Paperclip className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Attach</span>
        </button>

        {/* Share & Export Modal Trigger */}
        <button
          onClick={onOpenShareModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200/80 dark:hover:bg-white/[0.08] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.07] text-xs font-medium transition-colors cursor-pointer"
          title="Share key & Export capsule"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Share</span>
        </button>

        {/* Capsule Settings & Menu */}
        <div className="relative">
          <button
            onClick={onToggleOptionsMenu}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Capsule options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {isOptionsMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-44 rounded-lg bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.08] shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-100"
              onMouseLeave={onCloseOptionsMenu}
            >
              <button
                onClick={() => {
                  onCloseOptionsMenu();
                  onOpenEditModal();
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] flex items-center gap-2 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                <span>Edit Info</span>
              </button>

              <button
                onClick={() => {
                  onCloseOptionsMenu();
                  onDeleteCapsule();
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Capsule</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
