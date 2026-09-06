import { create } from 'zustand';
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
  | 'settings'
  | 'bridge';

export type NotificationType = 'info' | 'error' | 'success' | 'reminder';

interface Notification {
  message: string;
  type: NotificationType;
}

interface ItemState {
  // ── State ──────────────────────────────────────────────
  items: Item[];
  itemCounts: ItemCounts;
  loading: boolean;
  currentView: NavigationView;
  selectedItemId: string | null;
  searchQuery: string;
  activeTagId: string | null;
  notification: Notification | null;

  // ── Actions ────────────────────────────────────────────
  setCurrentView: (view: NavigationView) => void;
  setSelectedItemId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setActiveTagId: (tagId: string | null) => void;

  notify: (message: string, type?: NotificationType) => void;
  dismissNotification: () => void;

  refreshItems: () => Promise<void>;
  refreshCounts: () => Promise<void>;

  captureItem: (input: CreateItemInput) => Promise<Item>;
  updateItem: (id: string, updates: Partial<Item>) => Promise<Item>;
  toggleFavorite: (id: string) => Promise<void>;
  toggleArchive: (id: string) => Promise<void>;
  toggleTask: (itemId: string, completed: boolean) => Promise<void>;
  trashItem: (id: string) => Promise<void>;
  restoreItem: (id: string) => Promise<void>;
  permanentDeleteItem: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  importFilesFromPaths: (paths: string[]) => Promise<Item[]>;
}

let notificationTimer: ReturnType<typeof setTimeout> | null = null;

export const useItemStore = create<ItemState>()((set, get) => ({
  // ── Initial State ────────────────────────────────────────
  items: [],
  itemCounts: { inbox: 0, tasks: 0, notes: 0, files: 0, links: 0, archive: 0, trash: 0 },
  loading: true,
  currentView: 'inbox',
  selectedItemId: null,
  searchQuery: '',
  activeTagId: null,
  notification: null,

  // ── Navigation Actions ───────────────────────────────────
  setCurrentView: (view) => {
    set({ currentView: view });
    get().refreshItems();
    get().refreshCounts();
  },

  setSelectedItemId: (id) => {
    set({ selectedItemId: id });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    get().refreshItems();
  },

  setActiveTagId: (tagId) => {
    set({ activeTagId: tagId });
    get().refreshItems();
  },

  // ── Notification Actions ─────────────────────────────────
  notify: (message, type = 'info') => {
    if (notificationTimer) clearTimeout(notificationTimer);
    set({ notification: { message, type } });
    notificationTimer = setTimeout(() => {
      set({ notification: null });
      notificationTimer = null;
    }, 4000);
  },

  dismissNotification: () => {
    if (notificationTimer) {
      clearTimeout(notificationTimer);
      notificationTimer = null;
    }
    set({ notification: null });
  },

  // ── Data Refresh ─────────────────────────────────────────
  refreshCounts: async () => {
    try {
      const counts = await db.getItemCounts();
      set({ itemCounts: counts });
    } catch (err) {
      console.error('Failed to refresh counts:', err);
    }
  },

  refreshItems: async () => {
    set({ loading: true });
    const { currentView, searchQuery, activeTagId } = get();

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
        fetched = await db.getItems();
      }

      set({ items: fetched });
    } catch (err: any) {
      console.error('Failed to load items:', err);
      get().notify(`Could not load items: ${err.message}`, 'error');
    } finally {
      set({ loading: false });
    }
  },

  // ── CRUD Actions ─────────────────────────────────────────
  captureItem: async (input) => {
    try {
      const created = await db.createItem(input);
      get().notify(
        `Saved "${created.title.slice(0, 30)}${created.title.length > 30 ? '...' : ''}"`,
        'success'
      );
      await get().refreshItems();
      await get().refreshCounts();
      return created;
    } catch (err: any) {
      get().notify(`Failed to save: ${err.message}`, 'error');
      throw err;
    }
  },

  updateItem: async (id, updates) => {
    try {
      const updated = await db.updateItem(id, updates);
      set((state) => ({
        items: state.items.map((item) => (item.id === id ? updated : item)),
      }));
      if (
        updates.archived !== undefined ||
        updates.deletedAt !== undefined ||
        updates.status !== undefined
      ) {
        await get().refreshCounts();
      }
      return updated;
    } catch (err: any) {
      get().notify(`Update failed: ${err.message}`, 'error');
      throw err;
    }
  },

  toggleFavorite: async (id) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    await get().updateItem(id, { favorite: !item.favorite });
  },

  toggleArchive: async (id) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    const newArchived = !item.archived;
    await get().updateItem(id, { archived: newArchived });
    get().notify(newArchived ? 'Item archived' : 'Item unarchived', 'info');
    await get().refreshItems();
    await get().refreshCounts();
  },

  toggleTask: async (itemId, completed) => {
    try {
      await db.toggleTask(itemId, completed);
      set((state) => ({
        items: state.items.map((i) => {
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
        }),
      }));
      await get().refreshCounts();
    } catch (err: any) {
      get().notify(`Failed to toggle task: ${err.message}`, 'error');
    }
  },

  trashItem: async (id) => {
    try {
      await db.trashItem(id);
      get().notify('Moved item to Trash', 'info');
      await get().refreshItems();
      await get().refreshCounts();
      if (get().selectedItemId === id) set({ selectedItemId: null });
    } catch (err: any) {
      get().notify(`Failed to trash item: ${err.message}`, 'error');
    }
  },

  restoreItem: async (id) => {
    try {
      await db.restoreItem(id);
      get().notify('Restored item to Inbox', 'success');
      await get().refreshItems();
      await get().refreshCounts();
    } catch (err: any) {
      get().notify(`Failed to restore item: ${err.message}`, 'error');
    }
  },

  permanentDeleteItem: async (id) => {
    try {
      await db.permanentDeleteItem(id);
      get().notify('Item permanently deleted', 'info');
      await get().refreshItems();
      await get().refreshCounts();
      if (get().selectedItemId === id) set({ selectedItemId: null });
    } catch (err: any) {
      get().notify(`Failed to delete item: ${err.message}`, 'error');
    }
  },

  emptyTrash: async () => {
    try {
      await db.emptyTrash();
      get().notify('Trash emptied successfully', 'info');
      await get().refreshItems();
      await get().refreshCounts();
      set({ selectedItemId: null });
    } catch (err: any) {
      get().notify(`Failed to empty trash: ${err.message}`, 'error');
    }
  },

  importFilesFromPaths: async (paths) => {
    try {
      const imported = await db.importFilesFromPaths(paths);
      get().notify(`Imported ${imported.length} file(s) into Velco`, 'success');
      await get().refreshItems();
      await get().refreshCounts();
      return imported;
    } catch (err: any) {
      get().notify(`Failed to import files: ${err.message}`, 'error');
      throw err;
    }
  },
}));
