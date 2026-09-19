import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CheckSquare,
  FileText,
  Sparkles,
  Kanban,
  List,
  FolderGit2,
  Plus,
} from 'lucide-react';
import { PriorityLevel, ItemSummary, Item } from '../../types/item';
import { useSettings } from '../../stores/settingsStore';
import { useCapsuleStore } from '../../stores/capsuleStore';
import { useItemStore } from '../../stores/itemStore';
import { aiService } from '../../services/ai';
import { db } from '../../services/database';

import { CapsuleNavigator } from './components/CapsuleNavigator';
import { CapsuleHeader } from './components/CapsuleHeader';
import { CapsuleKanbanBoard } from './components/CapsuleKanbanBoard';
import { CapsuleDocEditor } from './components/CapsuleDocEditor';
import { CapsuleAiRecipes } from './components/CapsuleAiRecipes';
import { ShareCapsuleModal } from './components/ShareCapsuleModal';
import { JoinCapsuleModal } from './components/JoinCapsuleModal';
import { NewCapsuleModal } from './components/NewCapsuleModal';
import { EditCapsuleModal } from './components/EditCapsuleModal';
import { NewDocModal } from './components/NewDocModal';
import { AttachItemModal } from './components/AttachItemModal';
import { ConfirmModal } from '../../components/common/ConfirmModal';

interface CapsulesViewProps {
  onNotify?: (msg: string, type?: 'info' | 'success' | 'error' | 'reminder') => void;
}



export const CapsulesView: React.FC<CapsulesViewProps> = ({ onNotify }) => {
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
  const [joinTab, setJoinTab] = useState<'key' | 'file'>('key');
  const [isNewCapsuleOpen, setIsNewCapsuleOpen] = useState(false);
  const [isEditCapsuleOpen, setIsEditCapsuleOpen] = useState(false);
  const [isNewDocOpen, setIsNewDocOpen] = useState(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [attachSearchQuery, setAttachSearchQuery] = useState('');
  const [deleteConfirmCapsule, setDeleteConfirmCapsule] = useState<{ id: string; name: string } | null>(null);

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
  const [copiedDoc, setCopiedDoc] = useState(false);

  // Initial load
  useEffect(() => {
    void refreshCapsules();
  }, [refreshCapsules]);

  const activeCapsule = useMemo(() => {
    return capsules.find((c) => c.id === activeCapsuleId) || null;
  }, [capsules, activeCapsuleId]);



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
  const handleCopy = (text: string, type: 'key' | 'recipe' | 'doc') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
      onNotify?.('Invitation key copied to clipboard!', 'success');
    } else if (type === 'doc') {
      setCopiedDoc(true);
      setTimeout(() => setCopiedDoc(false), 2000);
      onNotify?.('Note content copied to clipboard!', 'success');
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

  const handleDeleteCapsule = (id: string, name: string) => {
    setDeleteConfirmCapsule({ id, name });
  };

  const confirmDeleteCapsuleAction = async () => {
    if (!deleteConfirmCapsule) return;
    const { id, name } = deleteConfirmCapsule;
    setDeleteConfirmCapsule(null);
    try {
      await deleteCapsule(id);
      onNotify?.(`Capsule "${name}" deleted`, 'info');
    } catch (err: any) {
      onNotify?.(`Failed to delete capsule: ${err.message || err}`, 'error');
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

  // Import or join capsule from raw JSON or invitation key
  const handleJoinCapsuleByInput = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = joinKeyInput.trim();
    if (!trimmed) return;

    try {
      if (trimmed.startsWith('{')) {
        const imported = await importCapsule(trimmed);
        setIsJoinModalOpen(false);
        setJoinKeyInput('');
        onNotify?.(`Imported "${imported.name}"! Click "Go Live" to sync on LAN.`, 'success');
      } else {
        const keyShort = trimmed.replace(/^vctx_live_/, '').slice(0, 6).toUpperCase();
        await createCapsule(
          `Joined Session (${keyShort})`,
          'Joined via peer invitation key',
          'Member',
          trimmed
        );
        setIsJoinModalOpen(false);
        setJoinKeyInput('');
        onNotify?.('Joined capsule! Click "Go Live" to connect with peers on your local network.', 'success');
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

      setFullDocItem((prev) =>
        prev
          ? {
              ...prev,
              title: editingDocTitle.trim() || prev.title,
              content: editingDocContent,
            }
          : null
      );

      await useCapsuleStore.getState().loadCapsuleItems(activeCapsule.id);

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

  // Available workspace items to attach
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
      {/* 1. LEFT PANE: CAPSULES NAVIGATOR */}
      <CapsuleNavigator
        capsules={capsules}
        filteredCapsules={filteredCapsules}
        activeCapsuleId={activeCapsuleId}
        activeCapsule={activeCapsule ?? undefined}
        loading={loading}
        capsuleSearchQuery={capsuleSearchQuery}
        copiedKey={copiedKey}
        p2pStatus={p2pStatus}
        onSearchChange={setCapsuleSearchQuery}
        onSelectCapsule={(id) => void selectCapsule(id)}
        onDeleteCapsule={(id, name) => void handleDeleteCapsule(id, name)}
        onOpenJoinModal={() => setIsJoinModalOpen(true)}
        onOpenNewCapsuleModal={() => setIsNewCapsuleOpen(true)}
        onRefreshCapsules={() => void refreshCapsules()}
        onCopyKey={(k) => handleCopy(k, 'key')}
      />

      {/* 2. RIGHT MAIN WORKSPACE CANVAS */}
      {activeCapsule ? (
        <main className="flex-1 flex flex-col min-w-0 max-w-full h-full overflow-hidden bg-white dark:bg-[#09090b]">
          {/* Header Bar */}
          <CapsuleHeader
            activeCapsule={activeCapsule}
            tasksCount={tasks.length}
            docsCount={docs.length}
            p2pStatus={p2pStatus}
            isP2PLoading={isP2PLoading}
            isOptionsMenuOpen={isOptionsMenuOpen}
            onToggleP2P={async () => {
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
            onOpenAttachModal={() => setIsAttachModalOpen(true)}
            onOpenShareModal={() => setIsShareModalOpen(true)}
            onToggleOptionsMenu={() => setIsOptionsMenuOpen((prev) => !prev)}
            onCloseOptionsMenu={() => setIsOptionsMenuOpen(false)}
            onOpenEditModal={() => {
              if (activeCapsule) {
                setEditCapsuleName(activeCapsule.name);
                setEditCapsuleDesc(activeCapsule.description || '');
              }
              setIsEditCapsuleOpen(true);
            }}
            onDeleteCapsule={() => void handleDeleteCapsule(activeCapsule.id, activeCapsule.name)}
          />

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

          {/* TAB CONTENT */}
          {activeTab === 'tasks' && (
            <CapsuleKanbanBoard
              tasks={tasks}
              taskViewMode={taskViewMode}
              newTaskTitle={newTaskTitle}
              newTaskPriority={newTaskPriority}
              newTaskDueDate={newTaskDueDate}
              onTitleChange={setNewTaskTitle}
              onPriorityChange={setNewTaskPriority}
              onDueDateChange={setNewTaskDueDate}
              onAddTask={handleAddTask}
              onToggleTask={handleToggleTask}
              onRemoveItem={handleRemoveItem}
              onSelectItem={setSelectedItemId}
            />
          )}

          {activeTab === 'docs' && (
            <CapsuleDocEditor
              docs={docs}
              filteredDocs={filteredDocs}
              selectedDocId={selectedDocId}
              fullDocItem={fullDocItem}
              docSearchQuery={docSearchQuery}
              isDocEditing={isDocEditing}
              isSavingDoc={isSavingDoc}
              editingDocTitle={editingDocTitle}
              editingDocContent={editingDocContent}
              copiedDoc={copiedDoc}
              onDocSearchChange={setDocSearchQuery}
              onSelectDoc={setSelectedDocId}
              onOpenNewDocModal={() => setIsNewDocOpen(true)}
              onStartEditing={() => setIsDocEditing(true)}
              onCancelEditing={() => {
                setIsDocEditing(false);
                if (fullDocItem) {
                  setEditingDocTitle(fullDocItem.title);
                  setEditingDocContent(fullDocItem.content || '');
                }
              }}
              onTitleChange={setEditingDocTitle}
              onContentChange={setEditingDocContent}
              onSaveDoc={() => void handleSaveDocContent()}
              onCopyDoc={(t) => handleCopy(t, 'doc')}
              onRemoveDoc={(id, title) => void handleRemoveItem(id, title)}
            />
          )}

          {activeTab === 'ai_recipes' && (
            <CapsuleAiRecipes
              capsuleItemsCount={capsuleItems.length}
              aiEnabled={settings.aiEnabled}
              isGeneratingRecipe={isGeneratingRecipe}
              activeRecipeKey={activeRecipeKey}
              activeRecipeTitle={activeRecipeTitle}
              recipeOutput={recipeOutput}
              copiedRecipe={copiedRecipe}
              onEnableAi={() => updateSettings({ aiEnabled: true })}
              onRunRecipe={(k) => void handleRunAiRecipe(k)}
              onSaveRecipeAsNote={() => void handleSaveRecipeAsNote()}
              onCopyRecipe={(t) => handleCopy(t, 'recipe')}
            />
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

      {/* Modals */}
      <ShareCapsuleModal
        isOpen={isShareModalOpen}
        activeCapsule={activeCapsule}
        copiedKey={copiedKey}
        onCopyKey={(k) => handleCopy(k, 'key')}
        onExportCapsule={() => void handleExportCapsule()}
        onClose={() => setIsShareModalOpen(false)}
      />

      <JoinCapsuleModal
        isOpen={isJoinModalOpen}
        joinTab={joinTab}
        joinKeyInput={joinKeyInput}
        onJoinTabChange={setJoinTab}
        onJoinKeyInputChange={setJoinKeyInput}
        onJoinByInput={handleJoinCapsuleByInput}
        onImportBundleFile={handleImportBundleFile}
        onClose={() => setIsJoinModalOpen(false)}
      />

      <NewCapsuleModal
        isOpen={isNewCapsuleOpen}
        name={newCapsuleName}
        description={newCapsuleDesc}
        onNameChange={setNewCapsuleName}
        onDescriptionChange={setNewCapsuleDesc}
        onCreateCapsule={handleCreateCapsule}
        onClose={() => setIsNewCapsuleOpen(false)}
      />

      <EditCapsuleModal
        isOpen={isEditCapsuleOpen}
        activeCapsule={activeCapsule}
        name={editCapsuleName}
        description={editCapsuleDesc}
        onNameChange={setEditCapsuleName}
        onDescriptionChange={setEditCapsuleDesc}
        onUpdateCapsule={handleUpdateCapsule}
        onClose={() => setIsEditCapsuleOpen(false)}
      />

      <NewDocModal
        isOpen={isNewDocOpen}
        capsuleName={activeCapsule?.name}
        title={newDocTitle}
        content={newDocContent}
        onTitleChange={setNewDocTitle}
        onContentChange={setNewDocContent}
        onCreateDoc={handleCreateDoc}
        onClose={() => setIsNewDocOpen(false)}
      />

      <AttachItemModal
        isOpen={isAttachModalOpen}
        attachSearchQuery={attachSearchQuery}
        attachableItems={attachableItems}
        onSearchChange={setAttachSearchQuery}
        onAttachItem={(item) => void handleAttachItem(item)}
        onClose={() => setIsAttachModalOpen(false)}
      />

      <ConfirmModal
        isOpen={deleteConfirmCapsule !== null}
        onClose={() => setDeleteConfirmCapsule(null)}
        onConfirm={confirmDeleteCapsuleAction}
        title="Delete Capsule?"
        message={`Are you sure you want to delete capsule "${deleteConfirmCapsule?.name || ''}"? Items inside will remain safe in your workspace.`}
        confirmText="Delete Capsule"
        variant="danger"
      />
    </div>
  );
};


