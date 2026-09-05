import { useState, useEffect, useCallback } from 'react';
import { Item, CreateItemInput, ItemCounts } from '../types/item';
import { db } from '../services/database';

export type NavigationView =
  | 'inbox'
  | 'notes'
  | 'tasks'
  | 'files'
  | 'links'
  | 'tags'
  | 'trash'
  | 'archive'
  | 'settings';

export function useItemStore() {
  const [items, setItems] = useState<Item[]>([]);
  const [itemCounts, setItemCounts] = useState<ItemCounts>({
    inbox: 0,
    tasks: 0,
    notes: 0,
    files: 0,
    links: 0,
    archive: 0,
    trash: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [currentView, setCurrentView] = useState<NavigationView>('inbox');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type?: 'info' | 'error' | 'success' } | null>(null);

  const notify = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const refreshCounts = useCallback(async () => {
    try {
      const counts = await db.getItemCounts();
      setItemCounts(counts);
    } catch (err) {
      console.error('Failed to refresh counts:', err);
    }
  }, []);

  const refreshItems = useCallback(async () => {
    setLoading(true);
    try {
      let fetched: Item[] = [];

      if (searchQuery.trim()) {
        fetched = await db.search(searchQuery);
      } else if (currentView === 'trash') {
        fetched = await db.getItems({ includeTrash: true });
      } else if (currentView === 'archive') {
        fetched = await db.getItems({ includeArchived: true });
        fetched = fetched.filter((i) => i.archived);
      } else if (currentView === 'notes') {
        fetched = await db.getItems({ type: 'note' });
      } else if (currentView === 'tasks') {
        fetched = await db.getItems({ type: 'task' });
      } else if (currentView === 'files') {
        fetched = await db.getItems({ type: 'file' });
      } else if (currentView === 'links') {
        fetched = await db.getItems({ type: 'link' });
      } else if (currentView === 'tags' && activeTagId) {
        fetched = await db.getItems({ tagId: activeTagId });
      } else {
        // 'inbox' view shows all non-archived, non-deleted items
        fetched = await db.getItems();
      }

      setItems(fetched);
    } catch (err: any) {
      console.error('Failed to load items:', err);
      notify(`Could not load items: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [currentView, searchQuery, activeTagId]);

  useEffect(() => {
    refreshItems();
    refreshCounts();
  }, [refreshItems, refreshCounts]);

  const captureItem = async (input: CreateItemInput): Promise<Item> => {
    try {
      const created = await db.createItem(input);
      notify(`Saved "${created.title.slice(0, 30)}${created.title.length > 30 ? '...' : ''}"`, 'success');
      await refreshItems();
      await refreshCounts();
      return created;
    } catch (err: any) {
      notify(`Failed to save: ${err.message}`, 'error');
      throw err;
    }
  };

  const updateItem = async (id: string, updates: Partial<Item>): Promise<Item> => {
    try {
      const updated = await db.updateItem(id, updates);
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      if (updates.archived !== undefined || updates.deletedAt !== undefined || updates.status !== undefined) {
        await refreshCounts();
      }
      return updated;
    } catch (err: any) {
      notify(`Update failed: ${err.message}`, 'error');
      throw err;
    }
  };

  const toggleFavorite = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    await updateItem(id, { favorite: !item.favorite });
  };

  const toggleTask = async (itemId: string, completed: boolean) => {
    try {
      await db.toggleTask(itemId, completed);
      setItems((prev) =>
        prev.map((i) => {
          if (i.id === itemId && i.task) {
            return {
              ...i,
              task: {
                ...i.task,
                completed,
                completedAt: completed ? new Date().toISOString() : null,
              },
            };
          }
          return i;
        })
      );
      await refreshCounts();
    } catch (err: any) {
      notify(`Failed to toggle task: ${err.message}`, 'error');
    }
  };

  const trashItem = async (id: string) => {
    try {
      await db.trashItem(id);
      notify('Moved item to Trash', 'info');
      await refreshItems();
      await refreshCounts();
      if (selectedItemId === id) setSelectedItemId(null);
    } catch (err: any) {
      notify(`Failed to trash item: ${err.message}`, 'error');
    }
  };

  const restoreItem = async (id: string) => {
    try {
      await db.restoreItem(id);
      notify('Restored item to Inbox', 'success');
      await refreshItems();
      await refreshCounts();
    } catch (err: any) {
      notify(`Failed to restore item: ${err.message}`, 'error');
    }
  };

  const permanentDeleteItem = async (id: string) => {
    try {
      await db.permanentDeleteItem(id);
      notify('Item permanently deleted', 'info');
      await refreshItems();
      await refreshCounts();
      if (selectedItemId === id) setSelectedItemId(null);
    } catch (err: any) {
      notify(`Failed to delete item: ${err.message}`, 'error');
    }
  };

  const emptyTrash = async () => {
    try {
      await db.emptyTrash();
      notify('Trash emptied successfully', 'info');
      await refreshItems();
      await refreshCounts();
      setSelectedItemId(null);
    } catch (err: any) {
      notify(`Failed to empty trash: ${err.message}`, 'error');
    }
  };

  const importFilesFromPaths = async (paths: string[]): Promise<Item[]> => {
    try {
      const imported = await db.importFilesFromPaths(paths);
      notify(`Imported ${imported.length} file(s) into Velco`, 'success');
      await refreshItems();
      await refreshCounts();
      return imported;
    } catch (err: any) {
      notify(`Failed to import files: ${err.message}`, 'error');
      throw err;
    }
  };

  const selectedItem = items.find((i) => i.id === selectedItemId) || null;

  return {
    items,
    itemCounts,
    loading,
    currentView,
    setCurrentView,
    selectedItemId,
    setSelectedItemId,
    selectedItem,
    searchQuery,
    setSearchQuery,
    activeTagId,
    setActiveTagId,
    captureItem,
    updateItem,
    toggleFavorite,
    toggleTask,
    trashItem,
    restoreItem,
    permanentDeleteItem,
    emptyTrash,
    importFilesFromPaths,
    refreshItems,
    refreshCounts,
    notification,
    notify,
  };
}
