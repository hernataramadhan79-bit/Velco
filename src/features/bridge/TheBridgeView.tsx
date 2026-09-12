import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FolderGit2,
  Plus,
  Download,
  Share2,
  Key,
  Lock,
  CheckSquare,
  FileText,
  Sparkles,
  Copy,
  Check,
  Trash2,
  Layers,
  AlertCircle,
  X,
  Zap,
  Upload,
  RefreshCw,
  Wifi,
  WifiOff,
  Users,
  Search,
  Eye,
  Edit3,
  Save,
  Kanban,
  List,
  MoreVertical,
  Calendar,
  Paperclip,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { PriorityLevel, ItemSummary, Item } from '../../types/item';
import { MarkdownViewer } from '../../components/common/MarkdownViewer';
import { useSettings } from '../../stores/settingsStore';
import { useCapsuleStore } from '../../stores/capsuleStore';
import { useItemStore } from '../../stores/itemStore';
import { aiService } from '../../services/ai';
import { db } from '../../services/database';

interface TheBridgeViewProps {
  onNotify?: (msg: string, type?: 'info' | 'success' | 'error' | 'reminder') => void;
}

export const TheBridgeView: React.FC<TheBridgeViewProps> = ({ onNotify }) => {
  const { settings, updateSettings } = useSettings();
  const {
    capsules,
    activeCapsuleId,
    capsuleItems,
    loading,
    refreshCapsules,
    selectCapsule,
    createCapsule,
    updateCapsule,
    deleteCapsule,
    addItemToCapsule,
    removeItemFromCapsule,
    exportCapsule,
    importCapsule,
    p2pStatus,
    isP2PLoading,
    startP2P,
    stopP2P,
    broadcastItemUpsert,
    broadcastTaskToggle,
    broadcastItemRemoved,
  } = useCapsuleStore();

  const { captureItem, updateItem, toggleTask, setSelectedItemId, items: allWorkspaceItems } = useItemStore();

  // Navigation tab inside active capsule
  const [activeTab, setActiveTab] = useState<'tasks' | 'docs' | 'ai_recipes'>('tasks');
  const [taskViewMode, setTaskViewMode] = useState<'board' | 'list'>('board');

  // Search & filter state
  const [capsuleSearchQuery, setCapsuleSearchQuery] = useState('');
  const [docSearchQuery, setDocSearchQuery] = useState('');

  // Modals state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isNewCapsuleOpen, setIsNewCapsuleOpen] = useState(false);
  const [isEditCapsuleOpen, setIsEditCapsuleOpen] = useState(false);
  const [isNewDocOpen, setIsNewDocOpen] = useState(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [attachSearchQuery, setAttachSearchQuery] = useState('');

  // Active Capsule Menu state
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);

  // Input states for capsule creation/edit
  const [joinKeyInput, setJoinKeyInput] = useState('');
  const [newCapsuleName, setNewCapsuleName] = useState('');
  const [newCapsuleDesc, setNewCapsuleDesc] = useState('');
  const [editCapsuleName, setEditCapsuleName] = useState('');
  const [editCapsuleDesc, setEditCapsuleDesc] = useState('');

  // Task creation inputs
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<PriorityLevel>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  // Note creation inputs
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocContent, setNewDocContent] = useState('');

  // Selected doc for viewing and editing
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [fullDocItem, setFullDocItem] = useState<Item | null>(null);
  const [isDocEditing, setIsDocEditing] = useState(false);
  const [editingDocTitle, setEditingDocTitle] = useState('');
  const [editingDocContent, setEditingDocContent] = useState('');
  const [isSavingDoc, setIsSavingDoc] = useState(false);

  // AI Recipe state
  const [recipeOutput, setRecipeOutput] = useState<string | null>(null);
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
  const [activeRecipeKey, setActiveRecipeKey] = useState<string>('synthesize');
  const [activeRecipeTitle, setActiveRecipeTitle] = useState<string>('');

  // Clipboard copy feedback
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedRecipe, setCopiedRecipe] = useState(false);

  // Initial load
  useEffect(() => {
    void refreshCapsules();
  }, [refreshCapsules]);

  const activeCapsule = useMemo(() => {
    return capsules.find((c) => c.id === activeCapsuleId) || null;
  }, [capsules, activeCapsuleId]);

  // Sync edit capsule modal state when active capsule changes
  useEffect(() => {
    if (activeCapsule) {
      setEditCapsuleName(activeCapsule.name);
      setEditCapsuleDesc(activeCapsule.description || '');
    }
  }, [activeCapsule]);

  // Filtered capsules in sidebar
  const filteredCapsules = useMemo(() => {
    if (!capsuleSearchQuery.trim()) return capsules;
    const q = capsuleSearchQuery.toLowerCase();
    return capsules.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q))
    );
  }, [capsules, capsuleSearchQuery]);

  // Split items into tasks and docs
  const tasks = useMemo(() => {
    return capsuleItems.filter((i) => i.type === 'task');
  }, [capsuleItems]);

  const docs = useMemo(() => {
    return capsuleItems.filter((i) => i.type === 'note' || i.type === 'text');
  }, [capsuleItems]);

  // Filtered docs in the docs sub-pane
  const filteredDocs = useMemo(() => {
    if (!docSearchQuery.trim()) return docs;
    const q = docSearchQuery.toLowerCase();
    return docs.filter(
      (d) => d.title.toLowerCase().includes(q) || (d.excerpt && d.excerpt.toLowerCase().includes(q))
    );
  }, [docs, docSearchQuery]);

  // Set default selected doc when docs change
  useEffect(() => {
    if (docs.length > 0) {
      if (!selectedDocId || !docs.some((d) => d.id === selectedDocId)) {
        setSelectedDocId(docs[0].id);
      }
    } else {
      setSelectedDocId(null);
      setFullDocItem(null);
    }
  }, [docs, selectedDocId]);

  // Load FULL doc content from SQLite whenever selectedDocId changes
  // Resolves the 120-character truncation bug!
  const loadFullDoc = useCallback(async (docId: string) => {
    try {
      const item = await db.getItem(docId);
      if (item) {
        setFullDocItem(item);
        setEditingDocTitle(item.title);
        setEditingDocContent(item.content || '');
      }
    } catch (err) {
      console.error('Failed to load full document:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedDocId) {
      void loadFullDoc(selectedDocId);
      setIsDocEditing(false);
    } else {
      setFullDocItem(null);
    }
  }, [selectedDocId, loadFullDoc]);

  // Copy helper
  const handleCopy = (text: string, type: 'key' | 'recipe') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
      onNotify?.('Invitation key copied to clipboard!', 'success');
    } else {
      setCopiedRecipe(true);
      setTimeout(() => setCopiedRecipe(false), 2000);
      onNotify?.('Content copied to clipboard!', 'success');
    }
  };

  // Capsule CRUD handlers
  const handleCreateCapsule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCapsuleName.trim()) return;

    try {
      const created = await createCapsule(newCapsuleName.trim(), newCapsuleDesc.trim(), 'Host');
      setIsNewCapsuleOpen(false);
      setNewCapsuleName('');
      setNewCapsuleDesc('');
      onNotify?.(`Capsule "${created.name}" created`, 'success');
    } catch (err: any) {
      onNotify?.(`Failed to create capsule: ${err.message || err}`, 'error');
    }
  };

  const handleUpdateCapsule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCapsule || !editCapsuleName.trim()) return;

    try {
      await updateCapsule(activeCapsule.id, {
        name: editCapsuleName.trim(),
        description: editCapsuleDesc.trim(),
      });
      setIsEditCapsuleOpen(false);
      onNotify?.('Capsule updated', 'success');
    } catch (err: any) {
      onNotify?.(`Failed to update capsule: ${err.message || err}`, 'error');
    }
  };

  const handleDeleteCapsule = async (id: string, name: string) => {
    if (window.confirm(`Delete capsule "${name}"? Items inside will remain safe in your workspace.`)) {
      try {
        await deleteCapsule(id);
        onNotify?.(`Capsule "${name}" deleted`, 'info');
      } catch (err: any) {
        onNotify?.(`Failed to delete capsule: ${err.message || err}`, 'error');
      }
    }
  };

  // Export capsule
  const handleExportCapsule = async () => {
    if (!activeCapsule) return;
    try {
      const bundle = await exportCapsule(activeCapsule.id);
      const dataStr = JSON.stringify(bundle, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeCapsule.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.vctx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      onNotify?.(`Exported as ${a.download}`, 'success');
    } catch (err: any) {
      onNotify?.(`Failed to export: ${err.message || err}`, 'error');
    }
  };

  // Import capsule from file
  const handleImportBundleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonStr = event.target?.result as string;
        const imported = await importCapsule(jsonStr);
        setIsJoinModalOpen(false);
        onNotify?.(`Imported "${imported.name}"`, 'success');
      } catch (err: any) {
        onNotify?.(`Failed to import: ${err.message || err}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Import capsule from raw JSON or key
  const handleJoinCapsuleByInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinKeyInput.trim()) return;

    try {
      if (joinKeyInput.trim().startsWith('{')) {
        const imported = await importCapsule(joinKeyInput.trim());
        setIsJoinModalOpen(false);
        setJoinKeyInput('');
        onNotify?.(`Imported "${imported.name}"`, 'success');
      } else {
        const created = await createCapsule(
          `Workspace (${joinKeyInput.slice(0, 8)})`,
          'Imported via key',
          'Member'
        );
        setIsJoinModalOpen(false);
        setJoinKeyInput('');
        onNotify?.('Connected to capsule via key', 'success');
      }
    } catch (err: any) {
      onNotify?.(`Failed to join: ${err.message || err}`, 'error');
    }
  };

  // Task creation
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !activeCapsule) return;

    try {
      const createdItem = await captureItem({
        type: 'task',
        title: newTaskTitle.trim(),
        task: {
          priority: newTaskPriority,
          completed: false,
          dueDate: newTaskDueDate || null,
        },
      });
      await addItemToCapsule(activeCapsule.id, createdItem.id);

      if (p2pStatus?.is_active) {
        void broadcastItemUpsert({
          capsuleId: activeCapsule.id,
          itemId: createdItem.id,
          itemType: 'task',
          title: newTaskTitle.trim(),
          content: '',
          priority: newTaskPriority,
          completed: false,
          dueDate: newTaskDueDate || undefined,
        });
      }

      setNewTaskTitle('');
      setNewTaskDueDate('');
      onNotify?.('Task added to capsule', 'success');
    } catch (err: any) {
      onNotify?.(`Failed to add task: ${err.message || err}`, 'error');
    }
  };

  // Task completion toggle
  const handleToggleTask = async (task: ItemSummary) => {
    if (!activeCapsule) return;
    try {
      const isCompleted = !!task.task?.completed;
      await toggleTask(task.id, !isCompleted);
      await useCapsuleStore.getState().loadCapsuleItems(activeCapsule.id);

      if (p2pStatus?.is_active) {
        void broadcastTaskToggle(activeCapsule.id, task.id, !isCompleted);
      }
    } catch (err: any) {
      onNotify?.(`Failed to toggle task: ${err.message || err}`, 'error');
    }
  };

  // Remove item from capsule
  const handleRemoveItem = async (itemId: string, itemTitle: string) => {
    if (!activeCapsule) return;
    try {
      await removeItemFromCapsule(activeCapsule.id, itemId);
      if (p2pStatus?.is_active) {
        void broadcastItemRemoved(activeCapsule.id, itemId);
      }
      onNotify?.(`Removed "${itemTitle}" from capsule`, 'info');
    } catch (err: any) {
      onNotify?.(`Failed to remove item: ${err.message || err}`, 'error');
    }
  };

  // Document creation
  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim() || !activeCapsule) return;

    try {
      const created = await captureItem({
        type: 'note',
        title: newDocTitle.trim(),
        content: newDocContent.trim(),
      });
      await addItemToCapsule(activeCapsule.id, created.id);

      if (p2pStatus?.is_active) {
        void broadcastItemUpsert({
          capsuleId: activeCapsule.id,
          itemId: created.id,
          itemType: 'note',
          title: newDocTitle.trim(),
          content: newDocContent.trim(),
        });
      }

      setIsNewDocOpen(false);
      setNewDocTitle('');
      setNewDocContent('');
      setSelectedDocId(created.id);
      onNotify?.(`Note "${created.title}" added to capsule`, 'success');
    } catch (err: any) {
      onNotify?.(`Failed to add note: ${err.message || err}`, 'error');
    }
  };

  // Document saving (inline editor)
  const handleSaveDocContent = async () => {
    if (!selectedDocId || !fullDocItem || !activeCapsule) return;
    setIsSavingDoc(true);

    try {
      await updateItem(selectedDocId, {
        title: editingDocTitle.trim() || fullDocItem.title,
        content: editingDocContent,
      });

      // Update full local item state
      setFullDocItem((prev) =>
        prev
          ? {
              ...prev,
              title: editingDocTitle.trim() || prev.title,
              content: editingDocContent,
            }
          : null
      );

      // Refresh capsule items list
      await useCapsuleStore.getState().loadCapsuleItems(activeCapsule.id);

      // Broadcast to P2P network if live
      if (p2pStatus?.is_active) {
        void broadcastItemUpsert({
          capsuleId: activeCapsule.id,
          itemId: selectedDocId,
          itemType: 'note',
          title: editingDocTitle.trim() || fullDocItem.title,
          content: editingDocContent,
        });
      }

      setIsDocEditing(false);
      onNotify?.('Note saved', 'success');
    } catch (err: any) {
      onNotify?.(`Failed to save note: ${err.message || err}`, 'error');
    } finally {
      setIsSavingDoc(false);
    }
  };

  // Attach existing workspace item to capsule
  const handleAttachItem = async (item: ItemSummary) => {
    if (!activeCapsule) return;
    try {
      await addItemToCapsule(activeCapsule.id, item.id);
      onNotify?.(`Attached "${item.title}" to capsule`, 'success');
    } catch (err: any) {
      onNotify?.(`Failed to attach: ${err.message || err}`, 'error');
    }
  };

  // AI Recipes
  const handleRunAiRecipe = async (recipeKey: 'synthesize' | 'matrix' | 'audit') => {
    if (!settings.aiEnabled) {
      onNotify?.('AI features are disabled in Settings', 'error');
      return;
    }
    if (!activeCapsule || capsuleItems.length === 0) {
      onNotify?.('Add tasks or notes to this capsule first', 'error');
      return;
    }

    setIsGeneratingRecipe(true);
    setRecipeOutput(null);
    setActiveRecipeKey(recipeKey);

    const titles: Record<string, string> = {
      synthesize: 'Multi-Perspective Synthesis',
      matrix: 'Action & Decision Matrix',
      audit: 'Integrity & Consistency Audit',
    };
    setActiveRecipeTitle(titles[recipeKey]);

    try {
      const itemIds = capsuleItems.map((i) => i.id);

      if (recipeKey === 'synthesize') {
        const res = await aiService.executeRecipe(itemIds, 'synthesize');
        setRecipeOutput(res.markdown_content || res.summary || 'Synthesis completed.');
      } else if (recipeKey === 'matrix') {
        const res = await aiService.executeRecipe(
          itemIds,
          'synthesize',
          'Create a structured Decision & Action Matrix table in Markdown based on all tasks and notes provided. Include columns: Priority, Action Item, Owner/Source, Status, and Impact.'
        );
        setRecipeOutput(res.markdown_content || res.summary || 'Matrix generated.');
      } else {
        const res = await aiService.executeRecipe(
          itemIds,
          'synthesize',
          'Perform a thorough Consistency & Integrity Audit on the context items. Evaluate data isolation, identify potential contradictions or ambiguities between tasks and notes, and list concrete recommendations.'
        );
        setRecipeOutput(res.markdown_content || res.summary || 'Audit report generated.');
      }
      onNotify?.('AI analysis completed', 'success');
    } catch (err: any) {
      console.error('AI Recipe Error:', err);
      setRecipeOutput(
        `### Analysis Note\n\nCould not execute with current AI provider: ${err.message || err}\n\n` +
        `Verify that your configured AI model (Ollama / LM Studio / Cloud API) is accessible in Settings.`
      );
      onNotify?.(`AI error: ${err.message || err}`, 'error');
    } finally {
      setIsGeneratingRecipe(false);
    }
  };

  // Save AI Recipe output as a note in the capsule
  const handleSaveRecipeAsNote = async () => {
    if (!recipeOutput || !activeCapsule) return;
    try {
      const title = `${activeRecipeTitle || 'AI Analysis'} (${new Date().toLocaleDateString()})`;
      const created = await captureItem({
        type: 'note',
        title,
        content: recipeOutput,
      });
      await addItemToCapsule(activeCapsule.id, created.id);

      if (p2pStatus?.is_active) {
        void broadcastItemUpsert({
          capsuleId: activeCapsule.id,
          itemId: created.id,
          itemType: 'note',
          title,
          content: recipeOutput,
        });
      }

      setActiveTab('docs');
      setSelectedDocId(created.id);
      onNotify?.('Saved as a note in this capsule', 'success');
    } catch (err: any) {
      onNotify?.(`Failed to save note: ${err.message || err}`, 'error');
    }
  };

  // Available workspace items to attach (excluding items already in active capsule)
  const attachableItems = useMemo(() => {
    const existingIds = new Set(capsuleItems.map((i) => i.id));
    return allWorkspaceItems
      .filter((i) => !existingIds.has(i.id) && !i.trashed && !i.archived)
      .filter((i) => {
        if (!attachSearchQuery.trim()) return true;
        const q = attachSearchQuery.toLowerCase();
        return i.title.toLowerCase().includes(q) || (i.excerpt && i.excerpt.toLowerCase().includes(q));
      });
  }, [allWorkspaceItems, capsuleItems, attachSearchQuery]);

  return (
    <div className="h-full w-full max-w-full flex min-h-0 select-none bg-white dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 overflow-hidden font-sans">
      {/* ─────────────────────────────────────────────────────────────
          1. LEFT PANE: CAPSULES NAVIGATOR
      ────────────────────────────────────────────────────────────── */}
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
              onClick={() => setIsJoinModalOpen(true)}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Import .vctx capsule"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => void refreshCapsules()}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Refresh capsules"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setIsNewCapsuleOpen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium transition-colors shadow-2xs cursor-pointer ml-1"
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
                onChange={(e) => setCapsuleSearchQuery(e.target.value)}
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
                onClick={() => void selectCapsule(cap.id)}
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
                      void handleDeleteCapsule(cap.id, cap.name);
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
                onClick={() => setIsNewCapsuleOpen(true)}
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
                onClick={() => handleCopy(activeCapsule.encryptionKey, 'key')}
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

      {/* ─────────────────────────────────────────────────────────────
          2. RIGHT MAIN WORKSPACE CANVAS
      ────────────────────────────────────────────────────────────── */}
      {activeCapsule ? (
        <main className="flex-1 flex flex-col min-w-0 max-w-full h-full overflow-hidden bg-white dark:bg-[#09090b]">
          {/* Unified Header Bar */}
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
                    {tasks.length} tasks &bull; {docs.length} notes
                  </span>
                </div>
              </div>
            </div>

            {/* Actions Toolbar */}
            <div className="flex items-center gap-2 shrink-0">
              {/* LAN Live / P2P Toggle */}
              <button
                onClick={async () => {
                  if (p2pStatus?.is_active) {
                    try {
                      await stopP2P();
                      onNotify?.('P2P LAN session stopped (offline)', 'info');
                    } catch (err: any) {
                      onNotify?.(`P2P error: ${err.message || err}`, 'error');
                    }
                  } else {
                    try {
                      await startP2P(activeCapsule.id);
                      onNotify?.('P2P LAN session live! Discovering local peers...', 'success');
                    } catch (err: any) {
                      onNotify?.(`P2P error: ${err.message || err}`, 'error');
                    }
                  }
                }}
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
                onClick={() => setIsAttachModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200/80 dark:hover:bg-white/[0.08] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.07] text-xs font-medium transition-colors cursor-pointer"
                title="Attach notes or tasks from your workspace"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Attach</span>
              </button>

              {/* Share & Export Modal Trigger */}
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200/80 dark:hover:bg-white/[0.08] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.07] text-xs font-medium transition-colors cursor-pointer"
                title="Share key & Export capsule"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>

              {/* Capsule Settings & Menu */}
              <div className="relative">
                <button
                  onClick={() => setIsOptionsMenuOpen((prev) => !prev)}
                  className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  title="Capsule Options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {isOptionsMenuOpen && (
                  <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.08] rounded-lg shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      onClick={() => {
                        setIsOptionsMenuOpen(false);
                        setIsEditCapsuleOpen(true);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] flex items-center gap-2 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Edit Capsule</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsOptionsMenuOpen(false);
                        void handleExportCapsule();
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                      <span>Export .vctx</span>
                    </button>
                    <div className="my-1 border-t border-slate-100 dark:border-white/[0.05]" />
                    <button
                      onClick={() => {
                        setIsOptionsMenuOpen(false);
                        void handleDeleteCapsule(activeCapsule.id, activeCapsule.name);
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

          {/* Navigation Tabs Bar */}
          <div className="px-6 border-b border-slate-200 dark:border-white/[0.07] flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-[#0c0c0f]/50">
            <div className="flex items-center gap-5">
              <button
                onClick={() => setActiveTab('tasks')}
                className={`pt-2.5 pb-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'tasks'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Tasks</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-white/[0.08] text-slate-600 dark:text-zinc-400">
                  {tasks.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('docs')}
                className={`pt-2.5 pb-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'docs'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Notes &amp; Briefs</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-white/[0.08] text-slate-600 dark:text-zinc-400">
                  {docs.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('ai_recipes')}
                className={`pt-2.5 pb-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'ai_recipes'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Intelligence</span>
              </button>
            </div>

            {/* Task View Mode Switcher (Board vs List) */}
            {activeTab === 'tasks' && (
              <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-white/[0.06] p-0.5 rounded-md">
                <button
                  onClick={() => setTaskViewMode('board')}
                  className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                    taskViewMode === 'board'
                      ? 'bg-white dark:bg-[#141418] text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                      : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800'
                  }`}
                  title="Kanban Board View"
                >
                  <Kanban className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setTaskViewMode('list')}
                  className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                    taskViewMode === 'list'
                      ? 'bg-white dark:bg-[#141418] text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                      : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800'
                  }`}
                  title="List View"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              TAB 1: TASKS (BOARD OR LIST)
          ────────────────────────────────────────────────────────────── */}
          {activeTab === 'tasks' && (
            <div className="flex-1 flex flex-col min-h-0 max-w-full overflow-hidden">
              {/* Quick Add Task Bar */}
              <div className="p-4 border-b border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#09090b] shrink-0">
                <form onSubmit={handleAddTask} className="flex items-center gap-2 max-w-4xl">
                  <input
                    type="text"
                    placeholder="Add a new task to this capsule..."
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-md bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />

                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as PriorityLevel)}
                    className="px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-white/[0.08] text-xs font-medium text-slate-700 dark:text-zinc-200 focus:outline-none cursor-pointer"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>

                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="px-2 py-1 rounded-md bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-700 dark:text-zinc-300 focus:outline-none cursor-pointer"
                    title="Due Date"
                  />

                  <button
                    type="submit"
                    disabled={!newTaskTitle.trim()}
                    className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Task</span>
                  </button>
                </form>
              </div>

              {/* View Content: Kanban Board or List */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-5">
                {taskViewMode === 'board' ? (
                  /* 3-Column Kanban Board with corrected priority/status logic */
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full min-h-[450px]">
                    {(['todo', 'in_progress', 'done'] as const).map((colStatus) => {
                      const colTasks = tasks.filter((t) => {
                        const isDone = !!t.task?.completed;
                        if (colStatus === 'done') return isDone;
                        const isHighPriority = t.task?.priority === 'high' || t.task?.priority === 'urgent';
                        if (colStatus === 'in_progress') return !isDone && isHighPriority;
                        return !isDone && !isHighPriority;
                      });

                      const colTitle =
                        colStatus === 'todo'
                          ? 'To Do'
                          : colStatus === 'in_progress'
                          ? 'Priority / In Progress'
                          : 'Completed';

                      return (
                        <div
                          key={colStatus}
                          className="rounded-xl bg-slate-50/70 dark:bg-[#0f0f13] border border-slate-200/80 dark:border-white/[0.06] p-3 flex flex-col min-h-[350px]"
                        >
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60 dark:border-white/[0.05]">
                            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                              {colTitle}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-white/[0.06] text-slate-500 dark:text-zinc-400">
                              {colTasks.length}
                            </span>
                          </div>

                          <div className="space-y-2 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
                            {colTasks.map((task) => (
                              <div
                                key={task.id}
                                onClick={() => setSelectedItemId(task.id)}
                                className="p-2.5 rounded-lg bg-white dark:bg-[#141418] border border-slate-200/90 dark:border-white/[0.07] hover:border-blue-400 dark:hover:border-white/[0.16] shadow-2xs space-y-1.5 transition-all cursor-pointer group"
                              >
                                <div className="flex items-start gap-2">
                                  <input
                                    type="checkbox"
                                    checked={!!task.task?.completed}
                                    onChange={() => void handleToggleTask(task)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="mt-0.5 rounded text-blue-600 focus:ring-0 cursor-pointer"
                                  />
                                  <span
                                    className={`text-xs flex-1 leading-snug truncate ${
                                      task.task?.completed
                                        ? 'line-through text-slate-400 dark:text-zinc-500'
                                        : 'text-slate-800 dark:text-zinc-200 font-medium'
                                    }`}
                                  >
                                    {task.title}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500 pt-1 border-t border-slate-100 dark:border-white/[0.03]">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`text-[9px] uppercase font-mono font-semibold px-1 py-0.2 rounded ${
                                        task.task?.priority === 'urgent'
                                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                                          : task.task?.priority === 'high'
                                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                                          : task.task?.priority === 'medium'
                                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300'
                                          : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-zinc-400'
                                      }`}
                                    >
                                      {task.task?.priority || 'medium'}
                                    </span>
                                    {task.task?.dueDate && (
                                      <span className="flex items-center gap-0.5 text-slate-500 dark:text-zinc-400">
                                        <Calendar className="w-2.5 h-2.5" />
                                        {task.task.dueDate}
                                      </span>
                                    )}
                                  </div>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleRemoveItem(task.id, task.title);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-500 transition-opacity cursor-pointer"
                                    title="Remove from capsule"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}

                            {colTasks.length === 0 && (
                              <div className="py-8 text-center text-[11px] text-slate-400 dark:text-zinc-600 border border-dashed border-slate-200 dark:border-white/[0.06] rounded-lg">
                                No tasks
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* List / Table View */
                  <div className="border border-slate-200 dark:border-white/[0.07] rounded-xl overflow-hidden bg-white dark:bg-[#141418]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-[#101014] text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-white/[0.07] font-medium text-[11px]">
                        <tr>
                          <th className="py-2 px-3 w-8"></th>
                          <th className="py-2 px-3">Title</th>
                          <th className="py-2 px-3 w-24">Priority</th>
                          <th className="py-2 px-3 w-32">Due Date</th>
                          <th className="py-2 px-3 w-16 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                        {tasks.map((task) => (
                          <tr
                            key={task.id}
                            onClick={() => setSelectedItemId(task.id)}
                            className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
                          >
                            <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={!!task.task?.completed}
                                onChange={() => void handleToggleTask(task)}
                                className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`font-medium ${
                                  task.task?.completed
                                    ? 'line-through text-slate-400 dark:text-zinc-500'
                                    : 'text-slate-800 dark:text-zinc-200'
                                }`}
                              >
                                {task.title}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`text-[9px] uppercase font-mono font-semibold px-1.5 py-0.2 rounded ${
                                  task.task?.priority === 'urgent'
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                                    : task.task?.priority === 'high'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                                    : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-zinc-400'
                                }`}
                              >
                                {task.task?.priority || 'medium'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 dark:text-zinc-400">
                              {task.task?.dueDate || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleRemoveItem(task.id, task.title);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity p-1 cursor-pointer"
                                title="Remove"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}

                        {tasks.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400 dark:text-zinc-600">
                              No tasks in this capsule yet
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 2: BRIEFS & DOCS (SPLIT READER & FULL EDITOR)
          ────────────────────────────────────────────────────────────── */}
          {activeTab === 'docs' && (
            <div className="flex-1 flex min-h-0 max-w-full overflow-hidden">
              {/* Left Sub-list of Notes */}
              <div className="w-64 border-r border-slate-200 dark:border-white/[0.07] bg-slate-50/40 dark:bg-[#0c0c0f] flex flex-col shrink-0">
                <div className="p-2.5 border-b border-slate-200 dark:border-white/[0.07] flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Notes ({docs.length})
                  </span>
                  <button
                    onClick={() => setIsNewDocOpen(true)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Note</span>
                  </button>
                </div>

                {docs.length > 3 && (
                  <div className="p-2 border-b border-slate-200/60 dark:border-white/[0.05]">
                    <input
                      type="text"
                      placeholder="Filter notes..."
                      value={docSearchQuery}
                      onChange={(e) => setDocSearchQuery(e.target.value)}
                      className="w-full px-2 py-1 rounded bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.07] text-xs text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none"
                    />
                  </div>
                )}

                <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1">
                  {filteredDocs.map((doc) => {
                    const isSelected = doc.id === selectedDocId;

                    return (
                      <button
                        key={doc.id}
                        onClick={() => setSelectedDocId(doc.id)}
                        className={`w-full text-left p-2 rounded-lg text-xs transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white dark:bg-[#141418] text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/30 shadow-2xs'
                            : 'text-slate-600 dark:text-zinc-400 hover:bg-white/60 dark:hover:bg-white/[0.03] border border-transparent'
                        }`}
                      >
                        <div className="truncate">{doc.title}</div>
                        <div className="text-[10px] text-slate-400 dark:text-zinc-500 line-clamp-1 mt-0.5">
                          {doc.excerpt || 'Empty note'}
                        </div>
                      </button>
                    );
                  })}

                  {filteredDocs.length === 0 && (
                    <div className="py-8 text-center text-xs text-slate-400 dark:text-zinc-500 space-y-2">
                      <FileText className="w-6 h-6 mx-auto stroke-[1.5] text-slate-300 dark:text-zinc-600" />
                      <p className="text-[11px]">No documents</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Document Detail & Editor */}
              <div className="flex-1 flex flex-col min-w-0 min-h-0 max-w-full bg-white dark:bg-[#09090b] overflow-hidden">
                {fullDocItem ? (
                  <div className="flex-1 flex flex-col min-h-0">
                    {/* Note Toolbar */}
                    <div className="px-6 py-2.5 border-b border-slate-200 dark:border-white/[0.07] flex items-center justify-between gap-4 shrink-0 bg-white/50 dark:bg-[#09090b]">
                      <div className="min-w-0 flex-1">
                        {isDocEditing ? (
                          <input
                            type="text"
                            value={editingDocTitle}
                            onChange={(e) => setEditingDocTitle(e.target.value)}
                            className="w-full text-sm font-bold text-slate-900 dark:text-zinc-100 bg-transparent border-b border-blue-500 focus:outline-none pb-0.5"
                          />
                        ) : (
                          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">
                            {fullDocItem.title}
                          </h3>
                        )}
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                          Updated {fullDocItem.updatedAt ? new Date(fullDocItem.updatedAt).toLocaleDateString() : 'recently'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Preview / Edit Mode Switch */}
                        <button
                          onClick={() => {
                            if (isDocEditing) {
                              void handleSaveDocContent();
                            } else {
                              setIsDocEditing(true);
                            }
                          }}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
                            isDocEditing
                              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-500'
                              : 'bg-slate-100 dark:bg-white/[0.05] border-slate-200 dark:border-white/[0.07] text-slate-700 dark:text-zinc-300 hover:bg-slate-200'
                          }`}
                        >
                          {isDocEditing ? (
                            <>
                              <Save className="w-3.5 h-3.5" />
                              <span>{isSavingDoc ? 'Saving...' : 'Save'}</span>
                            </>
                          ) : (
                            <>
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </>
                          )}
                        </button>

                        {isDocEditing && (
                          <button
                            onClick={() => {
                              setIsDocEditing(false);
                              setEditingDocTitle(fullDocItem.title);
                              setEditingDocContent(fullDocItem.content || '');
                            }}
                            className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}

                        <button
                          onClick={() => handleCopy(fullDocItem.content || '', 'recipe')}
                          className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                          title="Copy Markdown"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => void handleRemoveItem(fullDocItem.id, fullDocItem.title)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                          title="Remove from Capsule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Note Content Area */}
                    <div className="flex-1 p-6 overflow-y-auto overflow-x-hidden min-h-0">
                      {isDocEditing ? (
                        <textarea
                          value={editingDocContent}
                          onChange={(e) => setEditingDocContent(e.target.value)}
                          placeholder="Write markdown content..."
                          className="w-full h-full min-h-[350px] p-3 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none leading-relaxed"
                        />
                      ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <MarkdownViewer content={fullDocItem.content || '*Empty note*'} />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-400 dark:text-zinc-600">
                    Select a note to read or edit
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 3: INTELLIGENCE & AI RECIPES
          ────────────────────────────────────────────────────────────── */}
          {activeTab === 'ai_recipes' && (
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 space-y-5 max-w-4xl">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Capsule Intelligence
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Synthesize the {capsuleItems.length} items in this capsule to produce structured overviews and action matrices.
                </p>
              </div>

              {!settings.aiEnabled ? (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs text-amber-700 dark:text-amber-300 space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertCircle className="w-4 h-4" />
                    <span>AI is currently disabled</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Enable AI in Settings or click below to enable local AI models for context processing.
                  </p>
                  <button
                    onClick={() => updateSettings({ aiEnabled: true })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Enable AI Features</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div
                    onClick={() => void handleRunAiRecipe('synthesize')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer group ${
                      activeRecipeKey === 'synthesize' && isGeneratingRecipe
                        ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-950/20 ring-1 ring-blue-500/20'
                        : 'border-slate-200 dark:border-white/[0.07] bg-slate-50/50 dark:bg-[#141418] hover:border-blue-400'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      Multi-Perspective Synthesis
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                      Synthesize tasks and briefs into a consolidated executive action plan.
                    </p>
                  </div>

                  <div
                    onClick={() => void handleRunAiRecipe('matrix')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer group ${
                      activeRecipeKey === 'matrix' && isGeneratingRecipe
                        ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 ring-1 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-white/[0.07] bg-slate-50/50 dark:bg-[#141418] hover:border-emerald-400'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
                      <CheckSquare className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      Action &amp; Decision Matrix
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                      Extract structured decision tables, status, and owner impacts.
                    </p>
                  </div>

                  <div
                    onClick={() => void handleRunAiRecipe('audit')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer group ${
                      activeRecipeKey === 'audit' && isGeneratingRecipe
                        ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20 ring-1 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-white/[0.07] bg-slate-50/50 dark:bg-[#141418] hover:border-indigo-400'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      Integrity &amp; Risk Audit
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                      Detect contradictions between tasks, verify containment, and check completeness.
                    </p>
                  </div>
                </div>
              )}

              {/* Progress state */}
              {isGeneratingRecipe && (
                <div className="p-6 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/20 text-center space-y-2 animate-pulse">
                  <Sparkles className="w-5 h-5 text-blue-500 mx-auto animate-spin" />
                  <div className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    Running {activeRecipeTitle}...
                  </div>
                </div>
              )}

              {/* Output Result */}
              {recipeOutput && !isGeneratingRecipe && (
                <div className="p-5 rounded-xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#141418] space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/[0.07]">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      {activeRecipeTitle || 'Analysis Result'}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveRecipeAsNote}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors cursor-pointer"
                        title="Save as Note in this Capsule"
                      >
                        <Save className="w-3 h-3" />
                        <span>Save to Capsule</span>
                      </button>

                      <button
                        onClick={() => handleCopy(recipeOutput, 'recipe')}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 text-slate-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
                      >
                        {copiedRecipe ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span>Copy</span>
                      </button>
                    </div>
                  </div>

                  <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                    <MarkdownViewer content={recipeOutput} />
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      ) : (
        /* Empty State when no capsule is selected */
        <div className="flex-1 flex items-center justify-center p-8 text-center bg-white dark:bg-[#09090b]">
          <div className="max-w-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/[0.05] text-slate-400 dark:text-zinc-500 flex items-center justify-center mx-auto border border-slate-200 dark:border-white/[0.07]">
              <FolderGit2 className="w-5 h-5 stroke-[1.5]" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
              Select or Create a Capsule
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Organize related tasks and documentation into scoped context capsules.
            </p>
            <button
              onClick={() => setIsNewCapsuleOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Capsule</span>
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODALS
      ────────────────────────────────────────────────────────────── */}

      {/* 1. Unified Share & Export Modal */}
      {isShareModalOpen && activeCapsule && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.08] p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  Share Capsule &bull; {activeCapsule.name}
                </h3>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 block mb-1">
                  Invitation Key (Local / LAN Sync)
                </label>
                <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-2">
                  <code className="font-mono text-[11px] text-blue-600 dark:text-blue-400 truncate">
                    {activeCapsule.encryptionKey}
                  </code>
                  <button
                    onClick={() => handleCopy(activeCapsule.encryptionKey, 'key')}
                    className="p-1 rounded bg-white dark:bg-white/[0.08] text-slate-600 dark:text-zinc-300 hover:bg-slate-200 transition-colors shrink-0 cursor-pointer"
                    title="Copy Key"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-white/[0.05] flex items-center justify-between">
                <div>
                  <span className="font-medium text-slate-700 dark:text-zinc-300 block text-xs">
                    Portable Bundle (.vctx)
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                    Export entire capsule with full notes and tasks
                  </span>
                </div>
                <button
                  onClick={() => {
                    void handleExportCapsule();
                    setIsShareModalOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 text-slate-700 dark:text-zinc-300 text-xs font-medium cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Import Capsule Modal */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.08] p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  Import Capsule
                </h3>
              </div>
              <button
                onClick={() => setIsJoinModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block p-4 border-2 border-dashed border-slate-200 dark:border-white/[0.1] hover:border-blue-500 rounded-xl text-center cursor-pointer transition-colors">
                <Upload className="w-5 h-5 mx-auto text-blue-500 mb-1" />
                <span className="text-xs font-medium text-slate-700 dark:text-zinc-200 block">
                  Select a .vctx file
                </span>
                <input
                  type="file"
                  accept=".vctx,.json"
                  onChange={handleImportBundleFile}
                  className="hidden"
                />
              </label>

              <div className="relative flex items-center justify-center my-2">
                <div className="border-t border-slate-200 dark:border-white/[0.08] w-full" />
                <span className="bg-white dark:bg-[#141418] px-2 text-[10px] text-slate-400 uppercase">
                  Or paste invite key
                </span>
              </div>

              <form onSubmit={handleJoinCapsuleByInput} className="space-y-3">
                <input
                  type="text"
                  placeholder="Paste invitation key or JSON..."
                  value={joinKeyInput}
                  onChange={(e) => setJoinKeyInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsJoinModalOpen(false)}
                    className="px-3 py-1.5 rounded-md bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 text-slate-700 dark:text-zinc-300 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!joinKeyInput.trim()}
                    className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
                  >
                    Import
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 3. New Capsule Modal */}
      {isNewCapsuleOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateCapsule}
            className="w-full max-w-md bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.08] p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-100"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  New Context Capsule
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCapsuleOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 block mb-1">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Project Roadmap, Architecture Review..."
                  value={newCapsuleName}
                  onChange={(e) => setNewCapsuleName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 block mb-1">
                  Description (Optional)
                </label>
                <textarea
                  placeholder="Scope or brief of this capsule..."
                  value={newCapsuleDesc}
                  onChange={(e) => setNewCapsuleDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="pt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewCapsuleOpen(false)}
                className="px-3 py-1.5 rounded-md bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 text-slate-700 dark:text-zinc-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newCapsuleName.trim()}
                className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. Edit Capsule Modal */}
      {isEditCapsuleOpen && activeCapsule && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdateCapsule}
            className="w-full max-w-md bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.08] p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-100"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  Edit Capsule
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditCapsuleOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 block mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editCapsuleName}
                  onChange={(e) => setEditCapsuleName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 block mb-1">
                  Description
                </label>
                <textarea
                  value={editCapsuleDesc}
                  onChange={(e) => setEditCapsuleDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="pt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditCapsuleOpen(false)}
                className="px-3 py-1.5 rounded-md bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 text-slate-700 dark:text-zinc-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!editCapsuleName.trim()}
                className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. New Note Modal */}
      {isNewDocOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateDoc}
            className="w-full max-w-lg bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.08] p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-100"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  New Note &bull; {activeCapsule?.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewDocOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 block mb-1">
                  Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Architecture Specs, Meeting Notes..."
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 block mb-1">
                  Content (Markdown)
                </label>
                <textarea
                  placeholder="Write markdown note..."
                  value={newDocContent}
                  onChange={(e) => setNewDocContent(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="pt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewDocOpen(false)}
                className="px-3 py-1.5 rounded-md bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 text-slate-700 dark:text-zinc-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newDocTitle.trim()}
                className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
              >
                Create Note
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 6. Attach Existing Items from Workspace Modal */}
      {isAttachModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.08] p-5 space-y-3 shadow-2xl animate-in zoom-in-95 duration-100 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  Attach from Workspace
                </h3>
              </div>
              <button
                onClick={() => setIsAttachModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search notes and tasks to attach..."
                value={attachSearchQuery}
                onChange={(e) => setAttachSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-1 min-h-[220px] max-h-[350px] p-1 border border-slate-100 dark:border-white/[0.04] rounded-lg">
              {attachableItems.map((item) => (
                <div
                  key={item.id}
                  className="p-2 rounded-md hover:bg-slate-50 dark:hover:bg-white/[0.04] flex items-center justify-between gap-3 text-xs transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase px-1 py-0.2 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-zinc-400">
                        {item.type}
                      </span>
                      <span className="font-medium text-slate-800 dark:text-zinc-200 truncate">
                        {item.title}
                      </span>
                    </div>
                    {item.excerpt && (
                      <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate mt-0.5">
                        {item.excerpt}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => void handleAttachItem(item)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-[11px] font-medium transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Attach</span>
                  </button>
                </div>
              ))}

              {attachableItems.length === 0 && (
                <div className="py-12 text-center text-xs text-slate-400 dark:text-zinc-600">
                  {attachSearchQuery ? 'No matching items' : 'All workspace items are already attached'}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsAttachModalOpen(false)}
                className="px-3 py-1.5 rounded-md bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 text-slate-700 dark:text-zinc-300 text-xs font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
