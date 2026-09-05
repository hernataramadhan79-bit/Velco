import React, { useState, useEffect, useRef } from 'react';
import { Upload } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { TheFoundry } from '../workstation/TheFoundry';
import { useItemStore, NavigationView } from '../../stores/itemStore';
import { useTagStore } from '../../stores/tagStore';
import { useContextStore } from '../../stores/contextStore';
import { InboxView } from '../../features/inbox/InboxView';
import { TasksView } from '../../features/tasks/TasksView';
import { NotesView } from '../../features/notes/NotesView';
import { FilesView } from '../../features/files/FilesView';
import { LinksView } from '../../features/links/LinksView';
import { TagsView } from '../../features/tags/TagsView';
import { ArchiveView } from '../../features/archive/ArchiveView';
import { TrashView } from '../../features/trash/TrashView';
import { SettingsView } from '../../features/settings/SettingsView';
import { GlobalSearchModal } from '../../features/search/GlobalSearchModal';
import { ItemDetailModal } from '../items/ItemDetailModal';

export const AppLayout: React.FC = () => {
  const itemStore = useItemStore();
  const tagStore = useTagStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFoundryOpen, setIsFoundryOpen] = useState(false);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const previousViewRef = useRef<NavigationView>('inbox');

  const itemStoreRef = useRef(itemStore);
  useEffect(() => {
    itemStoreRef.current = itemStore;
  }, [itemStore]);

  const navigateToView = (view: NavigationView) => {
    if (itemStore.currentView !== 'settings') {
      previousViewRef.current = itemStore.currentView;
    }
    itemStore.setCurrentView(view);
  };

  const stagedCount = useContextStore((state) => state.stagedItems.length);

  // Native Tauri Drag-and-Drop listener
  useEffect(() => {
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    if (!isTauri) return;

    let unlisten: (() => void) | undefined;
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
              itemStoreRef.current.importFilesFromPaths(paths);
            }
          }
        })
        .then((fn) => {
          unlisten = fn;
        })
        .catch((err) => {
          console.warn('Failed to bind Tauri drag drop listener:', err);
        });
    } catch (err) {
      console.warn('Tauri window error:', err);
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Automatically open The Foundry when items are staged into the Context Cart
  useEffect(() => {
    if (stagedCount > 0) {
      setIsFoundryOpen(true);
    }
  }, [stagedCount]);

  // Global Keyboard Shortcuts (Ctrl+K: Search, Ctrl+J: Foundry, Ctrl+B: Toggle Sidebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsFoundryOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleEmptyTrash = async () => {
    await itemStore.emptyTrash();
  };

  // When viewing Settings, render dedicated full-screen view (hide default sidebar and header)
  if (itemStore.currentView === 'settings') {
    return (
      <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
        <SettingsView
          onBack={() => {
            itemStore.setCurrentView(previousViewRef.current);
          }}
        />

        {/* Global Search Modal */}
        <GlobalSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectItem={(item) => {
            itemStore.setSelectedItemId(item.id);
            itemStore.setCurrentView(previousViewRef.current);
          }}
        />

        {/* Item Detail Inspector Modal */}
        <ItemDetailModal
          item={itemStore.selectedItem}
          isOpen={itemStore.selectedItemId !== null}
          onClose={() => itemStore.setSelectedItemId(null)}
          onUpdate={itemStore.updateItem}
          onTrash={itemStore.trashItem}
          allTags={tagStore.tags}
          onCreateTag={tagStore.addTag}
        />

        {/* Global Notification Toast */}
        {itemStore.notification && (
          <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <span>{itemStore.notification.message}</span>
          </div>
        )}

        {/* Global Drag & Drop Overlay */}
        {isGlobalDragging && (
          <div className="fixed inset-0 z-50 pointer-events-none bg-blue-600/15 backdrop-blur-[2px] flex items-center justify-center border-4 border-dashed border-blue-500 rounded-2xl m-4 transition-all animate-in fade-in duration-150">
            <div className="bg-white/95 dark:bg-slate-900/95 p-8 rounded-3xl shadow-2xl border border-blue-500/30 text-center max-w-md pointer-events-auto">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4 border border-blue-200 dark:border-blue-800 shadow-inner animate-bounce">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                Drop Files into Velco
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Release anywhere to instantly import and index documents, images, and attachments locally.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-slate-100 dark:bg-slate-950 overflow-hidden font-sans">
      {/* Pane 1: Collapsible Sidebar */}
      <div
        className={`transition-all duration-200 ease-in-out flex shrink-0 overflow-hidden ${
          isSidebarOpen ? 'w-64' : 'w-0'
        }`}
      >
        <Sidebar
          currentView={itemStore.currentView}
          onSelectView={navigateToView}
          itemCounts={itemStore.itemCounts}
          tags={tagStore.tags}
          selectedTagId={tagStore.selectedTagId}
          onSelectTag={(tagId) => {
            tagStore.setSelectedTagId(tagId);
            itemStore.setActiveTagId(tagId);
          }}
          onOpenSearch={() => setIsSearchOpen(true)}
          onToggleSidebar={() => setIsSidebarOpen(false)}
        />
      </div>

      {/* Pane 2: Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white dark:bg-slate-900/50">
        <Header
          currentView={itemStore.currentView}
          onNewCaptureClick={() => navigateToView('inbox')}
          isFoundryOpen={isFoundryOpen}
          onToggleFoundry={() => setIsFoundryOpen((prev) => !prev)}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />

        {/* Scrollable View Content */}
        <main className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
          {itemStore.currentView === 'inbox' && (
            <InboxView
              items={itemStore.items}
              onCapture={itemStore.captureItem}
              onSelect={(item) => itemStore.setSelectedItemId(item.id)}
              onToggleTask={itemStore.toggleTask}
              onToggleFavorite={itemStore.toggleFavorite}
              onTrash={itemStore.trashItem}
            />
          )}

          {itemStore.currentView === 'tasks' && (
            <TasksView
              tasks={itemStore.items}
              onCapture={itemStore.captureItem}
              onSelect={(item) => itemStore.setSelectedItemId(item.id)}
              onToggleTask={itemStore.toggleTask}
              onToggleFavorite={itemStore.toggleFavorite}
              onTrash={itemStore.trashItem}
            />
          )}

          {itemStore.currentView === 'notes' && (
            <NotesView
              notes={itemStore.items}
              onCapture={itemStore.captureItem}
              onSelect={(item) => itemStore.setSelectedItemId(item.id)}
              onToggleFavorite={itemStore.toggleFavorite}
              onTrash={itemStore.trashItem}
            />
          )}

          {itemStore.currentView === 'files' && (
            <FilesView
              files={itemStore.items}
              onCapture={itemStore.captureItem}
              onSelect={(item) => itemStore.setSelectedItemId(item.id)}
              onToggleFavorite={itemStore.toggleFavorite}
              onTrash={itemStore.trashItem}
              isDraggingFiles={isGlobalDragging}
            />
          )}

          {itemStore.currentView === 'links' && (
            <LinksView
              links={itemStore.items}
              onCapture={itemStore.captureItem}
              onSelect={(item) => itemStore.setSelectedItemId(item.id)}
              onToggleFavorite={itemStore.toggleFavorite}
              onTrash={itemStore.trashItem}
            />
          )}

          {itemStore.currentView === 'tags' && (
            <TagsView
              tags={tagStore.tags}
              items={itemStore.items}
              selectedTagId={tagStore.selectedTagId}
              onSelectTag={(tagId) => {
                tagStore.setSelectedTagId(tagId);
                itemStore.setActiveTagId(tagId);
              }}
              onAddTag={tagStore.addTag}
              onRemoveTag={tagStore.removeTag}
              onSelect={(item) => itemStore.setSelectedItemId(item.id)}
              onToggleTask={itemStore.toggleTask}
              onToggleFavorite={itemStore.toggleFavorite}
              onTrash={itemStore.trashItem}
            />
          )}

          {itemStore.currentView === 'archive' && (
            <ArchiveView
              items={itemStore.items}
              onSelect={(item) => itemStore.setSelectedItemId(item.id)}
              onToggleFavorite={itemStore.toggleFavorite}
              onTrash={itemStore.trashItem}
            />
          )}

          {itemStore.currentView === 'trash' && (
            <TrashView
              items={itemStore.items}
              onSelect={(item) => itemStore.setSelectedItemId(item.id)}
              onRestore={itemStore.restoreItem}
              onPermanentDelete={itemStore.permanentDeleteItem}
              onEmptyTrash={handleEmptyTrash}
            />
          )}
        </main>
      </div>

      {/* Pane 3: The Foundry (Context Workstation) */}
      {isFoundryOpen && (
        <aside className="w-88 xl:w-96 shrink-0 h-full overflow-hidden transition-all duration-200 shadow-xl z-20">
          <TheFoundry
            onClose={() => setIsFoundryOpen(false)}
            onArtifactsApplied={() => {
              itemStore.refreshItems();
              itemStore.refreshCounts();
              itemStore.notify('Recipe artifacts committed to SQLite!', 'success');
            }}
          />
        </aside>
      )}

      {/* Item Detail Inspector Modal */}
      <ItemDetailModal
        item={itemStore.selectedItem}
        isOpen={itemStore.selectedItemId !== null}
        onClose={() => itemStore.setSelectedItemId(null)}
        onUpdate={itemStore.updateItem}
        onTrash={itemStore.trashItem}
        allTags={tagStore.tags}
        onCreateTag={tagStore.addTag}
      />

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectItem={(item) => itemStore.setSelectedItemId(item.id)}
      />

      {/* Global Notification Toast */}
      {itemStore.notification && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span>{itemStore.notification.message}</span>
        </div>
      )}

      {/* Global Drag & Drop Overlay */}
      {isGlobalDragging && (
        <div className="fixed inset-0 z-50 pointer-events-none bg-blue-600/15 backdrop-blur-[2px] flex items-center justify-center border-4 border-dashed border-blue-500 rounded-2xl m-4 transition-all animate-in fade-in duration-150">
          <div className="bg-white/95 dark:bg-slate-900/95 p-8 rounded-3xl shadow-2xl border border-blue-500/30 text-center max-w-md pointer-events-auto">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4 border border-blue-200 dark:border-blue-800 shadow-inner animate-bounce">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Drop Files into Velco
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Release anywhere to instantly import and index documents, images, and attachments locally.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
