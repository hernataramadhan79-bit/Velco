import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useItemStore } from '../../stores/itemStore';
import { useTagStore } from '../../stores/tagStore';
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

  // Global Keyboard Shortcuts (Ctrl+K for search, Escape, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleEmptyTrash = async () => {
    const trashItems = itemStore.items.filter((i) => i.deletedAt != null);
    for (const item of trashItems) {
      await itemStore.permanentDeleteItem(item.id);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-100 dark:bg-slate-950 overflow-hidden font-sans">
      {/* Sidebar */}
      <Sidebar
        currentView={itemStore.currentView}
        onSelectView={(v) => itemStore.setCurrentView(v)}
        itemCounts={itemStore.itemCounts}
        tags={tagStore.tags}
        selectedTagId={tagStore.selectedTagId}
        onSelectTag={(tagId) => {
          tagStore.setSelectedTagId(tagId);
          itemStore.setActiveTagId(tagId);
        }}
        onOpenSearch={() => setIsSearchOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white dark:bg-slate-900/50">
        <Header
          currentView={itemStore.currentView}
          onNewCaptureClick={() => itemStore.setCurrentView('inbox')}
        />

        {/* Scrollable View Content */}
        <main className="flex-1 overflow-y-auto px-8 py-6">
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

          {itemStore.currentView === 'settings' && <SettingsView />}
        </main>
      </div>

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
    </div>
  );
};
