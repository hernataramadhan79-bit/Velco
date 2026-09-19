import React, { useState, useEffect, useRef, lazy, Suspense, useCallback, useMemo } from 'react';
import { Upload, Bell, X, AlertCircle } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { UpdateBanner } from '../updater/UpdateBanner';
import { BackupReminderBanner, dismissBackupReminderForSession } from '../backup/BackupReminderBanner';
import { OnboardingOverlay } from '../onboarding/OnboardingOverlay';
import { ShortcutCheatSheetModal } from '../common/ShortcutCheatSheetModal';
import { Workbench } from '../workbench/Workbench';
import { useItemStore, NavigationView } from '../../stores/itemStore';
import { useTagStore } from '../../stores/tagStore';
import { useContextStore } from '../../stores/contextStore';
import { GlobalSearchModal } from '../../features/search/GlobalSearchModal';
import { ItemDetailModal } from '../items/ItemDetailModal';
import { SelectionActionBar } from '../common/SelectionActionBar';
import { useSelectionStore } from '../../stores/selectionStore';
import { usePlaygroundChatStore } from '../../stores/playgroundChatStore';
import { ViewSkeleton } from '../common/ViewSkeleton';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { reminderService } from '../../services/reminder/reminderService';
import { isTaskOverdue } from '../../utils/dateUtils';
import { db } from '../../services/database';

// ── Lazy-loaded view components ────────────────────────────
const InboxView = lazy(() =>
  import('../../features/inbox/InboxView').then((m) => ({ default: m.InboxView }))
);
const TasksView = lazy(() =>
  import('../../features/tasks/TasksView').then((m) => ({ default: m.TasksView }))
);
const NotesView = lazy(() =>
  import('../../features/notes/NotesView').then((m) => ({ default: m.NotesView }))
);
const FilesView = lazy(() =>
  import('../../features/files/FilesView').then((m) => ({ default: m.FilesView }))
);
const LinksView = lazy(() =>
  import('../../features/links/LinksView').then((m) => ({ default: m.LinksView }))
);
const TagsView = lazy(() =>
  import('../../features/tags/TagsView').then((m) => ({ default: m.TagsView }))
);
const ArchiveView = lazy(() =>
  import('../../features/archive/ArchiveView').then((m) => ({ default: m.ArchiveView }))
);
const TrashView = lazy(() =>
  import('../../features/trash/TrashView').then((m) => ({ default: m.TrashView }))
);
const SettingsView = lazy(() =>
  import('../../features/settings/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const CapsulesView = lazy(() =>
  import('../../features/capsules/CapsulesView').then((m) => ({ default: m.CapsulesView }))
);
const PlaygroundView = lazy(() =>
  import('../../features/playground/PlaygroundView').then((m) => ({ default: m.PlaygroundView }))
);

// ── Drag Drop Indicator ────────────────────────────────────
interface DragDropIndicatorProps {
  isDragging: boolean;
}

const DragDropIndicator: React.FC<DragDropIndicatorProps> = ({ isDragging }) => {
  if (!isDragging) return null;
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center gap-3 px-4 py-2.5 rounded-lg bg-white dark:bg-[#141418] text-slate-900 dark:text-white shadow-2xl border border-slate-200 dark:border-white/[0.12] transform-gpu toast-enter">
      <div className="w-7 h-7 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
        <Upload className="w-4 h-4" />
      </div>
      <div className="flex flex-col text-left">
        <div className="text-xs font-semibold text-slate-800 dark:text-zinc-100 flex items-center gap-1.5">
          Drop files to import
          <span className="text-[10px] font-mono bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-zinc-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/[0.08]">Velco</span>
        </div>
        <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
          Release anywhere to attach
        </div>
      </div>
    </div>
  );
};

// ── Notification Toast ─────────────────────────────────────
const NotificationToast: React.FC = React.memo(() => {
  const notification = useItemStore((s) => s.notification);
  const dismissNotification = useItemStore((s) => s.dismissNotification);
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      dismissNotification();
      setIsExiting(false);
    }, 150);
  };

  if (!notification) return null;

  const isReminder = notification.type === 'reminder';
  const isError = notification.type === 'error';

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 px-3.5 py-2.5 rounded-lg shadow-2xl flex items-center gap-3 transform-gpu border select-none max-w-sm ${
        isExiting ? 'notification-exit' : 'toast-enter'
      } ${
        isError
          ? 'bg-white dark:bg-[#141418] text-slate-900 dark:text-zinc-100 border-rose-500/50 shadow-rose-500/10 ring-1 ring-rose-500/20'
          : isReminder
          ? 'bg-white dark:bg-[#141418] text-slate-900 dark:text-zinc-100 border-blue-500/50 shadow-blue-500/10 ring-1 ring-blue-500/20'
          : 'bg-white dark:bg-[#141418] text-slate-900 dark:text-zinc-100 border-slate-200 dark:border-white/[0.1]'
      }`}
    >
      {isError ? (
        <>
          <div className="w-7 h-7 rounded-md bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 pr-1 flex-1">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-rose-400 font-mono">
              Error
            </div>
            <div className="text-xs font-medium text-slate-800 dark:text-zinc-200 truncate">
              {notification.message}
            </div>
          </div>
        </>
      ) : isReminder ? (
        <>
          <div className="w-7 h-7 rounded-md bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
            <Bell className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 pr-1 flex-1">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-blue-400 font-mono">
              Task Reminder
            </div>
            <div className="text-xs font-medium text-slate-800 dark:text-zinc-200 truncate">
              {notification.message}
            </div>
          </div>
        </>
      ) : (
        <span className="text-xs font-medium text-slate-800 dark:text-zinc-200 flex-1">{notification.message}</span>
      )}

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors cursor-pointer shrink-0"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
});
NotificationToast.displayName = 'NotificationToast';

// ══════════════════════════════════════════════════════════
// AppLayout — Main Application Shell
// ══════════════════════════════════════════════════════════
export const AppLayout: React.FC = () => {
  // ── Zustand selectors (granular subscriptions) ───────────
  const currentView = useItemStore((s) => s.currentView);
  const appMode = useItemStore((s) => s.appMode);
  const selectedItemId = useItemStore((s) => s.selectedItemId);
  const itemCounts = useItemStore((s) => s.itemCounts);

  // Zustand actions (stable references — never cause re-renders)
  const setCurrentView = useItemStore((s) => s.setCurrentView);
  const setSelectedItemId = useItemStore((s) => s.setSelectedItemId);
  const handleSelectItem = useCallback((item: any) => setSelectedItemId(item.id), [setSelectedItemId]);
  const setActiveTagId = useItemStore((s) => s.setActiveTagId);
  const captureItem = useItemStore((s) => s.captureItem);
  const updateItem = useItemStore((s) => s.updateItem);
  const toggleTask = useItemStore((s) => s.toggleTask);
  const toggleFavorite = useItemStore((s) => s.toggleFavorite);
  const toggleArchive = useItemStore((s) => s.toggleArchive);
  const trashItem = useItemStore((s) => s.trashItem);
  const restoreItem = useItemStore((s) => s.restoreItem);
  const permanentDeleteItem = useItemStore((s) => s.permanentDeleteItem);
  const emptyTrash = useItemStore((s) => s.emptyTrash);
  const refreshItems = useItemStore((s) => s.refreshItems);
  const refreshCounts = useItemStore((s) => s.refreshCounts);
  const notify = useItemStore((s) => s.notify);

  const selectedItem = useItemStore((s) => s.activeItemDetail);

  // Tag store
  const tagStore = useTagStore();

  // Local UI state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isWorkbenchOpen, setIsWorkbenchOpen] = useState(false);
  const [isWorkbenchExpanded, setIsWorkbenchExpanded] = useState(false);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCheatSheetOpen, setIsCheatSheetOpen] = useState(false);
  const previousViewRef = useRef<NavigationView>('inbox');

  const navigateToView = useCallback((view: NavigationView) => {
    const current = useItemStore.getState().currentView;
    if (current !== 'settings') {
      previousViewRef.current = current;
    }
    if (view === 'workbench') {
      setIsWorkbenchOpen(true);
      setIsWorkbenchExpanded(true);
      return;
    }
    if (view === 'playground' && current !== 'playground') {
      usePlaygroundChatStore.getState().newSession();
    }
    setCurrentView(view);
  }, [setCurrentView]);

  const stagedCount = useContextStore((state) => state.stagedItems.length);

  // ── Initial data load ────────────────────────────────────
  useEffect(() => {
    refreshItems();
    refreshCounts();
    try {
      useTagStore.getState().refreshTags();
    } catch {
      /* ignore */
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // In-memory overdue tasks count using primitive number selector — zero layout re-render cascades
  const overdueCount = useItemStore((s) =>
    s.items.reduce((count, i) => {
      if (
        i.type === 'task' &&
        !i.archived &&
        !i.trashed &&
        !i.task?.completed &&
        isTaskOverdue(i.task?.dueDate)
      ) {
        return count + 1;
      }
      return count;
    }, 0)
  );

  // ── Background Reminder Service ──────────────────────────
  useEffect(() => {
    reminderService.start(
      () => db.getItems({ type: 'task' }),
      (msg) => useItemStore.getState().notify(msg, 'reminder')
    );
    return () => {
      reminderService.stop();
    };
  }, []);

  // ── Dismiss Backup Reminder on Settings Entry ─────────────
  useEffect(() => {
    if (currentView === 'settings') {
      dismissBackupReminderForSession();
    }
  }, [currentView]);

  // ── Native Tauri Drag-and-Drop listener ──────────────────
  useEffect(() => {
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    if (!isTauri) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;
    try {
      getCurrentWindow()
        .onDragDropEvent((event) => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            setIsGlobalDragging(true);
          } else if (event.payload.type === 'leave') {
            setIsGlobalDragging(false);
          } else if (event.payload.type === 'drop') {
            setIsGlobalDragging(false);
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              useItemStore.getState().importFilesFromPaths(paths);
            }
          }
        })
        .then((fn) => {
          if (cancelled) {
            // Unmount terjadi sebelum promise resolve — langsung lepas agar tidak bocor
            fn();
          } else {
            unlisten = fn;
          }
        })
        .catch((err) => {
          console.warn('Failed to bind Tauri drag drop listener:', err);
        });
    } catch (err) {
      console.warn('Tauri window error:', err);
    }

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, []);

  // ── Auto-open Workbench when items are staged ──────────
  // Jangan setState saat render (StrictMode double-render bisa auto-open 2x).
  const [prevStagedCount, setPrevStagedCount] = useState(stagedCount);
  useEffect(() => {
    if (stagedCount !== prevStagedCount) {
      setPrevStagedCount(stagedCount);
      if (stagedCount > prevStagedCount && stagedCount > 0) {
        setIsWorkbenchOpen(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagedCount]);

  // ── Global Keyboard Shortcuts ────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsWorkbenchOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      } else if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setIsCheatSheetOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleEmptyTrash = async () => {
    await emptyTrash();
  };

  // ── Settings View (full-screen) ──────────────────────────
  if (currentView === 'settings') {
    return (
      <div className="flex h-full w-full max-w-full bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 overflow-hidden font-sans">
        <ErrorBoundary onReset={() => setCurrentView('inbox')}>
          <Suspense fallback={<ViewSkeleton />}>
            <SettingsView
              onBack={() => {
                setCurrentView(previousViewRef.current);
              }}
            />
          </Suspense>
        </ErrorBoundary>

        <GlobalSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectItem={(item) => {
            setSelectedItemId(item.id);
            setCurrentView(previousViewRef.current);
          }}
          onSwitchSession={(id) => {
            usePlaygroundChatStore.getState().switchSession(id);
            navigateToView('playground');
            setIsSearchOpen(false);
          }}
        />

        <ErrorBoundary onReset={() => setSelectedItemId(null)}>
          <ItemDetailModal
            item={selectedItem}
            isOpen={selectedItemId !== null}
            onClose={() => setSelectedItemId(null)}
            onUpdate={updateItem}
            onTrash={trashItem}
            allTags={tagStore.tags}
            onCreateTag={tagStore.addTag}
          />
        </ErrorBoundary>

        <NotificationToast />
        <DragDropIndicator isDragging={isGlobalDragging} />
      </div>
    );
  }

  // ── Main Layout ──────────────────────────────────────────
  return (
    <div className="flex h-full w-full max-w-full bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 overflow-hidden font-sans">
      {/* Pane 1: Collapsible Sidebar */}
      {appMode === 'personal' && (
        <div
          className={`transition-[width,opacity] duration-200 ease-in-out flex shrink-0 overflow-hidden ${
            isSidebarOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 pointer-events-none'
          }`}
        >
          <Sidebar
            currentView={currentView}
            onSelectView={navigateToView}
            itemCounts={itemCounts}
            overdueCount={overdueCount}
            tags={tagStore.tags}
            selectedTagId={tagStore.selectedTagId}
            onSelectTag={(tagId) => {
              tagStore.setSelectedTagId(tagId);
              setActiveTagId(tagId);
            }}
            onOpenSearch={() => setIsSearchOpen(true)}
            onToggleSidebar={() => setIsSidebarOpen(false)}
          />
        </div>
      )}

      {/* Pane 2: Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 max-w-full h-full overflow-hidden bg-slate-50 dark:bg-[#09090b]">
        <UpdateBanner />
        <BackupReminderBanner />
        <Header
          currentView={currentView}
          onNewCaptureClick={() => navigateToView('inbox')}
          isWorkbenchOpen={isWorkbenchOpen}
          onToggleWorkbench={() => setIsWorkbenchOpen((prev) => !prev)}
          isSidebarOpen={appMode === 'personal' ? isSidebarOpen : true}
          onToggleSidebar={appMode === 'personal' ? () => setIsSidebarOpen((prev) => !prev) : undefined}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenCheatSheet={() => setIsCheatSheetOpen(true)}
        />

        {/* Scrollable View Content */}
        <main
          className={`flex-1 min-h-0 min-w-0 max-w-full ${
            currentView === 'playground' || appMode === 'capsules'
              ? 'p-0 flex flex-col overflow-hidden'
              : 'overflow-y-auto overflow-x-hidden px-8 py-6'
          }`}
        >
          <ErrorBoundary onReset={() => refreshItems()}>
            <Suspense fallback={<ViewSkeleton />}>
              {appMode === 'capsules' ? (
                <CapsulesView onNotify={(msg, type) => notify(msg, type)} />
              ) : (
              <div
                className={`view-enter ${
                  currentView === 'playground'
                    ? 'flex-1 flex flex-col h-full min-h-0 overflow-hidden'
                    : ''
                }`}
                key={currentView}
              >
              {currentView === 'inbox' && (
                <InboxView
                  
                  onCapture={captureItem}
                  onSelect={handleSelectItem}
                  onToggleTask={toggleTask}
                  onToggleFavorite={toggleFavorite}
                  onTrash={trashItem}
                  onOpenSettings={() => navigateToView('settings')}
                  onArtifactCreated={(msg) => {
                    refreshItems();
                    refreshCounts();
                    notify(msg, 'success');
                  }}
                />
              )}

              {currentView === 'tasks' && (
                <TasksView
                  onCapture={captureItem}
                  onSelect={handleSelectItem}
                  onToggleTask={toggleTask}
                  onToggleFavorite={toggleFavorite}
                  onTrash={trashItem}
                />
              )}

              {currentView === 'notes' && (
                <NotesView
                  onCapture={captureItem}
                  onSelect={handleSelectItem}
                  onToggleFavorite={toggleFavorite}
                  onTrash={trashItem}
                />
              )}

              {currentView === 'files' && (
                <FilesView
                  onCapture={captureItem}
                  onSelect={handleSelectItem}
                  onToggleFavorite={toggleFavorite}
                  onTrash={trashItem}
                  isDraggingFiles={isGlobalDragging}
                />
              )}

              {currentView === 'links' && (
                <LinksView
                  onCapture={captureItem}
                  onSelect={handleSelectItem}
                  onToggleFavorite={toggleFavorite}
                  onTrash={trashItem}
                />
              )}

              {currentView === 'tags' && (
                <TagsView
                  tags={tagStore.tags}
                  
                  selectedTagId={tagStore.selectedTagId}
                  onSelectTag={(tagId) => {
                    tagStore.setSelectedTagId(tagId);
                    setActiveTagId(tagId);
                  }}
                  onAddTag={tagStore.addTag}
                  onRemoveTag={tagStore.removeTag}
                  onSelect={handleSelectItem}
                  onToggleTask={toggleTask}
                  onToggleFavorite={toggleFavorite}
                  onTrash={trashItem}
                />
              )}

              {currentView === 'archive' && (
                <ArchiveView
                  
                  onSelect={handleSelectItem}
                  onToggleFavorite={toggleFavorite}
                  onTrash={trashItem}
                  onToggleArchive={toggleArchive}
                />
              )}

              {currentView === 'trash' && (
                <TrashView
                  
                  onSelect={handleSelectItem}
                  onRestore={restoreItem}
                  onPermanentDelete={permanentDeleteItem}
                  onEmptyTrash={handleEmptyTrash}
                />
              )}

              {/* CapsulesView is now rendered exclusively in Capsules mode */}

              {currentView === 'playground' && (
                <PlaygroundView
                  onOpenSettings={() => navigateToView('settings')}
                  onArtifactCreated={(msg) => {
                    refreshItems();
                    refreshCounts();
                    notify(msg, 'success');
                  }}
                />
              )}
              </div>
              )}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* Pane 3: Workbench (Workbench) */}
      <aside
        className={`shrink-0 h-full overflow-hidden transition-[width,opacity,transform] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] shadow-2xl z-20 ${
          isWorkbenchOpen
            ? isWorkbenchExpanded
              ? 'w-[520px] xl:w-[600px] opacity-100 translate-x-0'
              : 'w-88 xl:w-96 opacity-100 translate-x-0'
            : 'w-0 opacity-0 translate-x-8 pointer-events-none'
        }`}
      >
        <Workbench
          onClose={() => setIsWorkbenchOpen(false)}
          isExpanded={isWorkbenchExpanded}
          onToggleExpand={() => setIsWorkbenchExpanded((prev) => !prev)}
          onArtifactsApplied={() => {
            refreshItems();
            refreshCounts();
            notify('Recipe artifacts committed to SQLite!', 'success');
          }}
          onArtifactCreated={(msg) => {
            refreshItems();
            refreshCounts();
            notify(msg, 'success');
          }}
          onOpenSettings={() => navigateToView('settings')}
        />
      </aside>

      {/* Item Detail Inspector Modal */}
      <ErrorBoundary onReset={() => setSelectedItemId(null)}>
        <ItemDetailModal
          item={selectedItem}
          isOpen={selectedItemId !== null}
          onClose={() => setSelectedItemId(null)}
          onUpdate={updateItem}
          onTrash={trashItem}
          onRestore={restoreItem}
          onPermanentDelete={permanentDeleteItem}
          allTags={tagStore.tags}
          onCreateTag={tagStore.addTag}
        />
      </ErrorBoundary>

      {/* Global Search Modal */}
      <ErrorBoundary onReset={() => setIsSearchOpen(false)}>
        <GlobalSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectItem={(item) => setSelectedItemId(item.id)}
          onSwitchSession={(id) => {
            usePlaygroundChatStore.getState().switchSession(id);
            navigateToView('playground');
            setIsSearchOpen(false);
          }}
        />
      </ErrorBoundary>

      {/* Global Notification Toast (Dismissible) */}
      <NotificationToast />

      {/* Global Drag & Drop Indicator */}
      <DragDropIndicator isDragging={isGlobalDragging} />

      {/* Global Multi-Select Action Bar */}
      <ErrorBoundary fallback={null} onReset={() => useSelectionStore.getState().clearSelection()}>
        <SelectionActionBar
          onOpenWorkbench={() => setIsWorkbenchOpen(true)}
          onFocusChat={() => {
            navigateToView('inbox');
          }}
        />
      </ErrorBoundary>

      {/* First-Run Onboarding Overlay */}
      <OnboardingOverlay />

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      <ShortcutCheatSheetModal
        isOpen={isCheatSheetOpen}
        onClose={() => setIsCheatSheetOpen(false)}
      />
    </div>
  );
};
