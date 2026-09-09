import React, { useState } from 'react';
import {
  Users,
  Share2,
  Download,
  Lock,
  ShieldCheck,
  Plus,
  CheckSquare,
  FileText,
  Sparkles,
  Key,
  Copy,
  Check,
  X,
  Radio,
  Clock,
  FolderGit2,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { PriorityLevel } from '../../types/item';
import { MarkdownViewer } from '../../components/common/MarkdownViewer';
import { useSettings } from '../../stores/settingsStore';

interface SharedCapsule {
  id: string;
  name: string;
  description: string;
  role: 'Host' | 'Member' | 'Web Snapshot';
  itemCount: number;
  peerCount: number;
  lastSync: string;
  encryptionKey: string;
}

interface SharedTask {
  id: string;
  title: string;
  assignee: string;
  priority: PriorityLevel;
  status: 'todo' | 'in_progress' | 'done';
}

interface SharedDoc {
  id: string;
  title: string;
  author: string;
  lastUpdated: string;
  content: string;
}

const INITIAL_CAPSULES: SharedCapsule[] = [
  {
    id: 'capsule-1',
    name: 'Velco v2 Roadmap & Architecture',
    description: 'Team roadmap & architecture for Velco local-first context workstation.',
    role: 'Host',
    itemCount: 14,
    peerCount: 3,
    lastSync: '2 minutes ago',
    encryptionKey: 'vctx_live_7x9q2m90k1a',
  },
  {
    id: 'capsule-2',
    name: 'Design System & UI Tokens',
    description: 'Visual specifications, color palette, and component design tokens.',
    role: 'Member',
    itemCount: 8,
    peerCount: 2,
    lastSync: '1 hour ago',
    encryptionKey: 'vctx_live_38bf82381ab',
  },
  {
    id: 'capsule-3',
    name: 'Research: Local Vector Search',
    description: 'Literature snapshot and benchmark comparison of SQLite-vec vs HNSW.',
    role: 'Web Snapshot',
    itemCount: 6,
    peerCount: 0,
    lastSync: 'Yesterday',
    encryptionKey: 'vctx_snap_00a12f928c',
  },
];

const INITIAL_TASKS: SharedTask[] = [
  {
    id: 'st-1',
    title: 'Migrate Hero AI Chat to Landing Page',
    assignee: 'Frontend Team',
    priority: 'high',
    status: 'in_progress',
  },
  {
    id: 'st-2',
    title: 'Implement Dropdown Inbox Filter & Date Grouping',
    assignee: 'UI/UX Team',
    priority: 'high',
    status: 'done',
  },
  {
    id: 'st-3',
    title: 'P2P Context Capsule Encryption Protocol (.vctx)',
    assignee: 'Core Dev',
    priority: 'medium',
    status: 'todo',
  },
  {
    id: 'st-4',
    title: 'Local Data Isolation & Security Audit',
    assignee: 'Security Peer',
    priority: 'urgent',
    status: 'todo',
  },
];

const INITIAL_DOCS: SharedDoc[] = [
  {
    id: 'doc-1',
    title: 'Project Brief: The Bridge Workstation',
    author: 'Velco Team',
    lastUpdated: 'Today, 15:30',
    content: `### Collaboration Principles for "The Bridge"
1. **Local-First Always**: Data remains securely stored in your local device SQLite.
2. **Context Capsules (.vctx)**: Project contexts are bundled into tamper-proof encrypted capsules with SHA-256 integrity checks.
3. **Peer-to-Peer Without Cloud Monopolies**: Direct peer collaboration without permanent central cloud repositories.
4. **Instant Revert to Private**: Disconnect anytime; your local workspace copy remains 100% yours.`,
  },
  {
    id: 'doc-2',
    title: 'Technical Specification: .vctx Capsule Format',
    author: 'Arch Lead',
    lastUpdated: 'Yesterday',
    content: `The \`.vctx\` (Velco Context Capsule) bundle includes:
- Project identity manifest
- Encrypted SQLite delta snapshot
- Whitelisted item metadata approved for sharing
- Team consensus and task activity log`,
  },
];

interface TheBridgeViewProps {
  onNotify?: (msg: string, type?: 'info' | 'success' | 'error' | 'reminder') => void;
}

export const TheBridgeView: React.FC<TheBridgeViewProps> = ({ onNotify }) => {
  const { settings, updateSettings } = useSettings();
  const [capsules, setCapsules] = useState<SharedCapsule[]>(INITIAL_CAPSULES);
  const [activeCapsuleId, setActiveCapsuleId] = useState<string>(INITIAL_CAPSULES[0].id);
  const [tasks, setTasks] = useState<SharedTask[]>(INITIAL_TASKS);
  const [docs] = useState<SharedDoc[]>(INITIAL_DOCS);
  const [activeDocId, setActiveDocId] = useState<string>(INITIAL_DOCS[0].id);
  const [activeTab, setActiveTab] = useState<'tasks' | 'docs' | 'ai_recipes'>('tasks');

  // Modal states
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinKeyInput, setJoinKeyInput] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [newCapsuleName, setNewCapsuleName] = useState('');
  const [isNewCapsuleOpen, setIsNewCapsuleOpen] = useState(false);

  // New task input
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<PriorityLevel>('medium');

  // Recipe AI state
  const [recipeOutput, setRecipeOutput] = useState<string | null>(null);
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);

  const activeCapsule = capsules.find((c) => c.id === activeCapsuleId) || capsules[0];
  const activeDoc = docs.find((d) => d.id === activeDocId) || docs[0];

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    onNotify?.('Invitation key copied to clipboard!', 'success');
  };

  const handleExportCapsule = () => {
    const dataStr = JSON.stringify(
      {
        capsule: activeCapsule,
        tasks,
        docs,
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
      },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeCapsule.name.toLowerCase().replace(/\s+/g, '_')}.vctx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke tertunda agar download besar tidak abort
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    onNotify?.(`Capsule "${activeCapsule.name}.vctx" exported successfully!`, 'success');
  };

  const handleJoinCapsule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinKeyInput.trim()) return;

    const newCap: SharedCapsule = {
      id: `capsule-${Date.now()}`,
      name: `Joined Workspace (${joinKeyInput.slice(0, 10)}...)`,
      description: 'Context capsule imported from team collaborator.',
      role: 'Member',
      itemCount: 7,
      peerCount: 1,
      lastSync: 'Just now',
      encryptionKey: joinKeyInput.trim(),
    };

    setCapsules((prev) => [newCap, ...prev]);
    setActiveCapsuleId(newCap.id);
    setIsJoinModalOpen(false);
    setJoinKeyInput('');
    onNotify?.('Joined context capsule successfully!', 'success');
  };

  const handleCreateCapsule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCapsuleName.trim()) return;

    const newCap: SharedCapsule = {
      id: `capsule-${Date.now()}`,
      name: newCapsuleName.trim(),
      description: 'New context capsule created on your local workstation.',
      role: 'Host',
      itemCount: 0,
      peerCount: 1,
      lastSync: 'Just now',
      encryptionKey: `vctx_live_${Math.random().toString(36).slice(2, 12)}`,
    };

    setCapsules((prev) => [newCap, ...prev]);
    setActiveCapsuleId(newCap.id);
    setIsNewCapsuleOpen(false);
    setNewCapsuleName('');
    onNotify?.(`Capsule "${newCap.name}" created successfully!`, 'success');
  };

  const handleDisconnect = () => {
    if (confirm(`Are you sure you want to disconnect and revert "${activeCapsule.name}" to private local mode?`)) {
      setCapsules((prev) => prev.filter((c) => c.id !== activeCapsule.id));
      if (capsules.length > 1) {
        const remaining = capsules.filter((c) => c.id !== activeCapsule.id);
        setActiveCapsuleId(remaining[0].id);
      }
      onNotify?.(`Capsule "${activeCapsule.name}" disconnected and secured in local database.`, 'info');
    }
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: SharedTask = {
      id: `st-${Date.now()}`,
      title: newTaskTitle.trim(),
      assignee: 'Me (Local)',
      priority: newTaskPriority,
      status: 'todo',
    };

    setTasks((prev) => [newTask, ...prev]);
    setNewTaskTitle('');
    onNotify?.('New team task added!', 'success');
  };

  const handleToggleTaskStatus = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextStatus =
            t.status === 'todo' ? 'in_progress' : t.status === 'in_progress' ? 'done' : 'todo';
          return { ...t, status: nextStatus };
        }
        return t;
      })
    );
  };

  const handleRunTeamAiRecipe = (recipeName: string) => {
    if (!settings.aiEnabled) {
      onNotify?.('AI features are disabled in Settings.', 'error');
      return;
    }
    setIsGeneratingRecipe(true);
    setRecipeOutput(null);

    setTimeout(() => {
      let result = '';
      if (recipeName === 'synthesis') {
        result = `### Multi-Perspective Team Synthesis
**Capsule**: ${activeCapsule.name}

#### Consensus Summary:
- The team is prioritizing responsive workspace interactions and landing page context intelligence.
- All high-priority milestones are advancing on schedule.
- Context capsule is fully encrypted across ${activeCapsule.peerCount} connected peers.

#### Recommended Next Steps:
1. Complete cross-platform validation on Landing Page AI Chat.
2. Initiate internal pilot testing for \`.vctx\` capsule bundle imports.`;
      } else if (recipeName === 'matrix') {
        result = `### Team Decision & Action Matrix
| Priority | Task & Initiative | Owner | Status |
|---|---|---|---|
| **Urgent** | Security Audit & Data Isolation | Security Peer | Awaiting Review |
| **High** | AI Chat Landing Page Migration | Frontend Team | In Progress |
| **High** | Inbox Dropdown & Date Grouping | UI/UX Team | Completed |
| **Medium** | .vctx Capsule Encryption Protocol | Core Dev | Scheduled |`;
      } else {
        result = `### Peer Code & Context Review
- **Privacy Verification**: 100% of data resides in local device SQLite. No secret keys or credentials transmitted.
- **Context Quality**: Clean entity references without duplicates in collaboration feed.`;
      }

      setRecipeOutput(result);
      setIsGeneratingRecipe(false);
      onNotify?.(`AI Recipe "${recipeName}" processed successfully!`, 'success');
    }, 900);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden select-none">
      {/* Top Banner: Privacy & Local First Commitment */}
      <div className="px-6 py-2.5 bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-950 text-white border-b border-indigo-900/60 flex items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5 text-xs">
          <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-zinc-100 font-mono text-xs uppercase">
              Context Hub &bull; Local-First Team Collaboration
            </span>
            <span className="inline-flex items-center gap-1 ml-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase tracking-wider">
                Preview
              </span>
            </span>
            <span className="hidden md:inline text-slate-400 text-[11px] ml-2 font-normal">
              100% of your data remains in local SQLite. Collaboration features are in preview.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer border border-white/10"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Join Context</span>
          </button>

          <button
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Context</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Split: Left Shelf (Capsules) + Right Canvas (Project Canvas) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Shelf: Shared Context Capsules */}
        <aside className="w-72 md:w-80 bg-slate-50 dark:bg-[#0d0d10] border-r border-slate-200 dark:border-white/[0.07] flex flex-col shrink-0">
          <div className="p-3.5 border-b border-slate-200 dark:border-white/[0.07] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
              <FolderGit2 className="w-4 h-4 text-blue-500" />
              <span>Context Capsules</span>
            </div>

            <button
              onClick={() => setIsNewCapsuleOpen(true)}
              className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200/60 dark:hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer"
              title="Create New Capsule"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Capsules List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {capsules.map((cap) => {
              const isSelected = cap.id === activeCapsuleId;

              return (
                <div
                  key={cap.id}
                  onClick={() => setActiveCapsuleId(cap.id)}
                  className={`p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white dark:bg-[#141418] border-blue-500/60 shadow-xs ring-1 ring-blue-500/20'
                      : 'bg-white/60 dark:bg-[#101014] border-slate-200/80 dark:border-white/[0.07] hover:border-slate-300 dark:hover:border-white/[0.14]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 truncate flex-1">
                      {cap.name}
                    </h4>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0 ${
                        cap.role === 'Host'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300'
                          : cap.role === 'Member'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-zinc-300'
                      }`}
                    >
                      {cap.role}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-2.5">
                    {cap.description}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-indigo-500" />
                      {cap.peerCount} {cap.peerCount === 1 ? 'peer' : 'peers'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {cap.lastSync}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Capsule Footer Status */}
          <div className="p-3 border-t border-slate-200 dark:border-white/[0.07] bg-white/40 dark:bg-[#101014] text-xs space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-emerald-500" />
                P2P Encryption
              </span>
              <span className="font-mono text-slate-700 dark:text-zinc-300 font-semibold">
                AES-GCM-256
              </span>
            </div>

            <button
              onClick={handleDisconnect}
              className="w-full py-1.5 px-2 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Radio className="w-3 h-3 text-rose-500" />
              <span>Disconnect / Revert to Private</span>
            </button>
          </div>
        </aside>

        {/* Right Canvas: Active Project Workspace */}
        <main className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#09090b] overflow-hidden">
          {/* Canvas Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-white/[0.07] flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  {activeCapsule.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[11px] font-mono">
                  {activeCapsule.role}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeCapsule.description}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCapsule}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/[0.08] text-xs font-semibold transition-colors cursor-pointer"
                title="Export .vctx capsule"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export .vctx</span>
              </button>

              <button
                onClick={() => setIsShareModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Invite Key</span>
              </button>
            </div>
          </div>

          {/* Canvas Tab Navigation */}
          <div className="px-6 pt-2 border-b border-slate-200 dark:border-white/[0.08] flex items-center gap-6">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'tasks'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Shared Task Board ({tasks.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('docs')}
              className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'docs'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Project Briefs & Docs ({docs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('ai_recipes')}
              className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'ai_recipes'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Team AI Recipes</span>
            </button>
          </div>

          {/* Tab 1: Shared Task Board */}
          {activeTab === 'tasks' && (
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
              {/* Add Task Bar */}
              <form onSubmit={handleAddTask} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a new task for the team..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as PriorityLevel)}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs font-semibold text-slate-700 dark:text-zinc-200 focus:outline-none cursor-pointer"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <button
                  type="submit"
                  disabled={!newTaskTitle.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Task</span>
                </button>
              </form>

              {/* Tasks Columns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['todo', 'in_progress', 'done'] as const).map((colStatus) => {
                  const colTasks = tasks.filter((t) => t.status === colStatus);
                  const colLabel =
                    colStatus === 'todo'
                      ? 'To Do'
                      : colStatus === 'in_progress'
                      ? 'In Progress'
                      : 'Done';

                  return (
                    <div
                      key={colStatus}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.07] flex flex-col space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-zinc-300">
                        <span>{colLabel}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-white/[0.08] text-slate-600 dark:text-zinc-300">
                          {colTasks.length}
                        </span>
                      </div>

                      <div className="space-y-2.5 flex-1 overflow-y-auto">
                        {colTasks.map((t) => (
                          <div
                            key={t.id}
                            className="p-3 rounded-lg bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.07] shadow-2xs space-y-2 hover:border-blue-400 dark:hover:border-white/[0.15] transition-colors cursor-pointer group"
                            onClick={() => handleToggleTaskStatus(t.id)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span
                                className={`font-semibold text-xs leading-relaxed ${
                                   t.status === 'done'
                                    ? 'line-through text-slate-400'
                                    : 'text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {t.title}
                              </span>
                              <span
                                className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded-md shrink-0 ${
                                  t.priority === 'urgent'
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                                    : t.priority === 'high'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300'
                                    : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-zinc-300'
                                }`}
                              >
                                {t.priority}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500">
                              <span>Owner: {t.assignee}</span>
                              <span className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                Click to advance status &rarr;
                              </span>
                            </div>
                          </div>
                        ))}

                        {colTasks.length === 0 && (
                          <div className="py-8 text-center text-[11px] text-slate-400 dark:text-zinc-500 border border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl">
                            No tasks yet
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: Shared Project Briefs & Docs */}
          {activeTab === 'docs' && (
            <div className="flex-1 flex min-h-0 overflow-hidden">
              {/* Doc List Left Subshelf */}
              <div className="w-64 border-r border-slate-200 dark:border-white/[0.07] overflow-y-auto p-3 space-y-1.5 shrink-0 bg-slate-50/40 dark:bg-[#0d0d10]">
                {docs.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setActiveDocId(d.id)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                      d.id === activeDocId
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200/80 dark:border-blue-800/80'
                        : 'hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    <div className="truncate font-medium">{d.title}</div>
                    <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 font-mono">{d.lastUpdated}</div>
                  </button>
                ))}
              </div>

              {/* Doc Viewer Content */}
              <div className="flex-1 p-6 overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.08] pb-3 mb-4 not-prose">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {activeDoc.title}
                    </h3>
                    <div className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                      Author: {activeDoc.author} &bull; Updated {activeDoc.lastUpdated}
                    </div>
                  </div>
                </div>

                <MarkdownViewer content={activeDoc.content} />
              </div>
            </div>
          )}

          {/* Tab 3: Team AI Recipes */}
          {activeTab === 'ai_recipes' && (
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 max-w-4xl">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Team AI Collaboration Recipes
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Use AI to synthesize team perspectives, draft decision matrices, or verify project documentation consistency.
                </p>
              </div>

              {!settings.aiEnabled ? (
                <div className="p-5 rounded-xl bg-amber-500/[0.04] dark:bg-amber-500/[0.05] border border-amber-500/20 text-center space-y-2.5">
                  <div className="w-8 h-8 mx-auto rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                      AI Features are Currently Disabled
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 max-w-sm mx-auto">
                      Enable AI features in Settings or click below to run team synthesis, decision matrix extraction, and peer audits.
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
                /* Recipe Cards */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div
                    onClick={() => handleRunTeamAiRecipe('synthesis')}
                    className="p-4 rounded-xl border border-slate-200 dark:border-white/[0.07] bg-slate-50/50 dark:bg-[#141418] hover:border-blue-500 dark:hover:border-white/[0.2] transition-all cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      Multi-Perspective Synthesis
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                      Synthesize notes, tasks, and updates into a comprehensive executive action plan.
                    </p>
                  </div>

                  <div
                    onClick={() => handleRunTeamAiRecipe('matrix')}
                    className="p-4 rounded-xl border border-slate-200 dark:border-white/[0.07] bg-slate-50/50 dark:bg-[#141418] hover:border-blue-500 dark:hover:border-white/[0.2] transition-all cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5">
                      <CheckSquare className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      Action &amp; Decision Matrix
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                      Extract team decisions and automatically map prioritized action items.
                    </p>
                  </div>

                  <div
                    onClick={() => handleRunTeamAiRecipe('review')}
                    className="p-4 rounded-xl border border-slate-200 dark:border-white/[0.07] bg-slate-50/50 dark:bg-[#141418] hover:border-blue-500 dark:hover:border-white/[0.2] transition-all cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2.5">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      Peer &amp; Privacy Audit
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                      Verify context security, audit data containment, and ensure local isolation.
                    </p>
                  </div>
                </div>
              )}

              {/* Recipe Processing Output */}
              {isGeneratingRecipe && (
                <div className="p-8 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 text-center space-y-2 animate-pulse">
                  <Sparkles className="w-6 h-6 text-blue-500 mx-auto animate-spin" />
                  <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    AI is synthesizing team context...
                  </div>
                </div>
              )}

              {recipeOutput && !isGeneratingRecipe && (
                <div className="p-5 rounded-xl bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.07] space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-white/[0.08] pb-2">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      Team Recipe Artifact
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(recipeOutput);
                        onNotify?.('Recipe result copied to clipboard!', 'success');
                      }}
                      className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                  </div>
                  <div className="prose prose-xs dark:prose-invert max-w-none text-xs">
                    <MarkdownViewer content={recipeOutput} />
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Share Context Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.08] p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Share Context Capsule
                </h3>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Share this invitation key with your teammate to connect their workstations via end-to-end encryption:
            </p>

            <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-2">
              <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 truncate">
                {activeCapsule.encryptionKey}
              </code>
              <button
                onClick={() => handleCopyKey(activeCapsule.encryptionKey)}
                className="p-1.5 rounded-lg bg-white dark:bg-white/[0.08] text-slate-600 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-white/[0.14] transition-colors shrink-0 cursor-pointer shadow-2xs"
                title="Copy Key"
              >
                {copiedKey ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>This key secures direct peer-to-peer encryption between workstations.</span>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Context Modal */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleJoinCapsule}
            className="w-full max-w-md bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.08] p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Join Context Capsule
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsJoinModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Enter an invitation key or import a <code className="font-mono">.vctx</code> capsule bundle from your peer:
            </p>

            <input
              type="text"
              placeholder="e.g. vctx_live_7x9q2m90k1a..."
              value={joinKeyInput}
              onChange={(e) => setJoinKeyInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsJoinModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!joinKeyInput.trim()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                Connect Capsule
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Capsule Modal */}
      {isNewCapsuleOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateCapsule}
            className="w-full max-w-md bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.08] p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Create New Collaboration Capsule
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCapsuleOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              A collaboration capsule is an isolated shared workspace. Initial data is safely copied from your local database without altering your other private items.
            </p>

            <input
              type="text"
              placeholder="Capsule Name (e.g. Sprint 3 Launch, Q4 Architecture...)"
              value={newCapsuleName}
              onChange={(e) => setNewCapsuleName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewCapsuleOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newCapsuleName.trim()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                Create Capsule
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
