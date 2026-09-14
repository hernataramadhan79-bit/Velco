import React from 'react';
import {
  FolderGit2,
  Plus,
  Lock,
  Copy,
  Check,
  Trash2,
  Layers,
  Search,
  LogIn,
  RefreshCw,
} from 'lucide-react';
import { Capsule, P2PStatus } from '../../../types/capsule';

interface CapsuleNavigatorProps {
  capsules: Capsule[];
  filteredCapsules: Capsule[];
  activeCapsuleId: string | null;
  activeCapsule: Capsule | undefined;
  loading: boolean;
  capsuleSearchQuery: string;
  copiedKey: boolean;
  p2pStatus: P2PStatus | null;
  onSearchChange: (query: string) => void;
  onSelectCapsule: (id: string) => void;
  onDeleteCapsule: (id: string, name: string) => void;
  onOpenJoinModal: () => void;
  onOpenNewCapsuleModal: () => void;
  onRefreshCapsules: () => void;
  onCopyKey: (key: string) => void;
}

export const CapsuleNavigator: React.FC<CapsuleNavigatorProps> = ({
  capsules,
  filteredCapsules,
  activeCapsuleId,
  activeCapsule,
  loading,
  capsuleSearchQuery,
  copiedKey,
  p2pStatus,
  onSearchChange,
  onSelectCapsule,
  onDeleteCapsule,
  onOpenJoinModal,
  onOpenNewCapsuleModal,
  onRefreshCapsules,
  onCopyKey,
}) => {
  return (
    <aside className="w-68 md:w-72 lg:w-76 border-r border-slate-200 dark:border-white/[0.07] bg-slate-50/60 dark:bg-[#0c0c0f] flex flex-col shrink-0">
      {/* Header Toolbar */}
      <div className="h-11 px-3.5 border-b border-slate-200 dark:border-white/[0.07] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold tracking-tight text-slate-800 dark:text-zinc-200 truncate">
            Capsules
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-white/[0.08] text-slate-600 dark:text-zinc-400 font-semibold">
            {capsules.length}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onOpenJoinModal}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-700 dark:text-zinc-200 text-[11px] font-medium transition-colors border border-slate-200 dark:border-white/[0.08] cursor-pointer"
            title="Join via key or import .vctx bundle"
          >
            <LogIn className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Join</span>
          </button>

          <button
            onClick={onRefreshCapsules}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Refresh capsules"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onOpenNewCapsuleModal}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium transition-colors shadow-2xs cursor-pointer ml-0.5"
            title="New Capsule"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* Optional quick search for capsules */}
      {capsules.length > 3 && (
        <div className="p-2 border-b border-slate-200/70 dark:border-white/[0.05]">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Filter capsules..."
              value={capsuleSearchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-7 pr-2 py-1 rounded-md bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.07] text-xs text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Capsules List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1">
        {filteredCapsules.map((cap) => {
          const isSelected = cap.id === activeCapsuleId;

          return (
            <div
              key={cap.id}
              onClick={() => onSelectCapsule(cap.id)}
              className={`p-2.5 rounded-lg border text-xs transition-all cursor-pointer group relative ${
                isSelected
                  ? 'bg-white dark:bg-[#141418] border-blue-500/40 shadow-xs ring-1 ring-blue-500/10'
                  : 'bg-transparent border-transparent hover:bg-white/80 dark:hover:bg-white/[0.04] hover:border-slate-200 dark:hover:border-white/[0.06]'
              }`}
            >
              <div className="flex items-start justify-between gap-1.5 mb-1">
                <span
                  className={`font-semibold truncate flex-1 ${
                    isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-zinc-200'
                  }`}
                >
                  {cap.name}
                </span>
                <span className="text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-zinc-400 shrink-0">
                  {cap.role}
                </span>
              </div>

              {cap.description && (
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1 leading-snug mb-1.5">
                  {cap.description}
                </p>
              )}

              <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500 pt-1 border-t border-slate-100 dark:border-white/[0.04]">
                <span className="flex items-center gap-1 font-mono">
                  <Layers className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                  {cap.itemCount} {cap.itemCount === 1 ? 'item' : 'items'}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteCapsule(cap.id, cap.name);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-500 transition-opacity cursor-pointer"
                  title="Delete capsule"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredCapsules.length === 0 && !loading && (
          <div className="py-12 px-3 text-center text-xs space-y-2.5">
            <FolderGit2 className="w-6 h-6 text-slate-400 dark:text-zinc-600 mx-auto stroke-[1.5]" />
            <div className="text-slate-500 dark:text-zinc-400 text-[11px]">
              {capsuleSearchQuery ? 'No matching capsules' : 'No capsules yet'}
            </div>
            <button
              onClick={onOpenNewCapsuleModal}
              className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium transition-colors cursor-pointer"
            >
              Create Capsule
            </button>
          </div>
        )}
      </div>

      {/* Sidebar Footer: Security & LAN Status */}
      {activeCapsule && (
        <div className="p-2.5 border-t border-slate-200 dark:border-white/[0.07] bg-white/40 dark:bg-[#0c0c0f] text-[11px] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-zinc-400 flex items-center gap-1 text-[10px]">
              <Lock className="w-3 h-3 text-emerald-500" />
              Vault Key
            </span>
            <button
              onClick={() => onCopyKey(activeCapsule.encryptionKey)}
              className="font-mono text-slate-600 dark:text-zinc-300 hover:text-blue-500 flex items-center gap-1 text-[10px] cursor-pointer"
              title="Click to copy invite key"
            >
              <span>{activeCapsule.encryptionKey.slice(0, 12)}...</span>
              {copiedKey ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
            </button>
          </div>

          {/* P2P Live Session Bar */}
          {p2pStatus?.is_active && (
            <div className="pt-1.5 border-t border-slate-200/60 dark:border-white/[0.05] flex items-center justify-between text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Port {p2pStatus.listen_port}
              </span>
              <span>
                {p2pStatus.connected_peers.length} peer{p2pStatus.connected_peers.length === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
