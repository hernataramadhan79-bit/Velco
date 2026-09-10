import { create } from 'zustand';
import { Item, ItemSummary, ItemDetail, CreateItemInput, ItemCounts } from '../types/item';
import { db } from '../services/database';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

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
  | 'bridge'
  | 'playground'
  | 'workbench';

export type NotificationType = 'info' | 'error' | 'success' | 'reminder';

interface Notification {
  message: string;
  type: NotificationType;
}

interface ItemState {
  // ── State ──────────────────────────────────────────────
  items: ItemSummary[];
  activeItemDetail: ItemDetail | null;
  itemCounts: ItemCounts;
  loading: boolean;
  loadingDetail: boolean;
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
  loadItemDetail: (id: string) => Promise<ItemDetail | null>;
  clearItemDetail: () => void;

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
  removeTagFromItems: (tagId: string) => void;
}

let notificationTimer: ReturnType<typeof setTimeout> | null = null;
// Request guards untuk cegah race: hanya respons terakhir yang boleh commit ke state.
let refreshSeq = 0;
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Helper: map raw backend item ke ItemSummary */
function mapToItemSummary(r: any): ItemSummary {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    excerpt: r.excerpt ?? (r.content ? String(r.content).slice(0, 120) : ''),
    pinned: !!r.pinned || !!r.favorite,
    archived: !!r.archived,
    trashed: !!r.trashed || !!r.deleted_at,
    createdAt: r.created_at ?? r.createdAt ?? '',
    updatedAt: r.updated_at ?? r.updatedAt ?? '',
    tags: (r.tags ?? []).map((t: any) => ({ id: t.id, name: t.name, color: t.color ?? '#3b82f6' })),
    content: r.content,
    source: r.source,
    status: r.status,
    favorite: !!r.favorite,
    deletedAt: r.deleted_at ?? r.deletedAt,
    task: r.task ? {
      id: r.task.id,
      itemId: r.id,
      priority: r.task.priority ?? 'medium',
      completed: !!r.task.completed,
      dueDate: r.task.due_date ?? r.task.dueDate,
      completedAt: r.task.completed_at ?? r.task.completedAt,
    } : null,
    link: r.link ? {
      id: r.link.id,
      itemId: r.id,
      url: r.link.url,
      domain: r.link.domain ?? '',
      pageTitle: r.link.page_title ?? r.link.pageTitle ?? '',
      previewImage: r.link.preview_image ?? r.link.previewImage,
    } : null,
    attachments: (r.attachments ?? []).map((a: any) => ({
      id: a.id,
      itemId: r.id,
      fileName: a.file_name ?? a.fileName,
      filePath: a.file_path ?? a.filePath,
      mimeType: a.mime_type ?? a.mimeType,
      fileSize: a.file_size ?? a.fileSize ?? 0,
      checksum: a.checksum ?? '',
      createdAt: a.created_at ?? a.createdAt ?? '',
      dataUrl: a.data_url ?? a.dataUrl,
    })),
    attachmentsCount: r.attachments_count ?? (r.attachments ? r.attachments.length : 0),
    thumbnailUrl: r.thumbnail_url ?? r.attachments?.[0]?.data_url ?? r.thumbnailUrl ?? null,
    aiMetadata: r.ai_metadata ?? r.aiMetadata,
  };
}

export const useItemStore = create<ItemState>()((set, get) => ({
  // ── Initial State ────────────────────────────────────────
  items: [],
  activeItemDetail: null,
  itemCounts: { inbox: 0, tasks: 0, notes: 0, files: 0, links: 0, archive: 0, trash: 0 },
  loading: true,
  loadingDetail: false,
  currentView: 'inbox',
  selectedItemId: null,
  searchQuery: '',
  activeTagId: null,
  notification: null,

  // ── Navigation Actions ───────────────────────────────────
  setCurrentView: (view) => {
    set({ currentView: view, activeItemDetail: null });
    // Paralel, bukan serial waterfall
    void Promise.all([get().refreshItems(), get().refreshCounts()]);
  },

  setSelectedItemId: (id) => {
    set({ selectedItemId: id });
    if (id) {
      void get().loadItemDetail(id);
    } else {
      set({ activeItemDetail: null, loadingDetail: false });
    }
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    // Debounce 250ms: ketik cepat tidak spam IPC
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchDebounceTimer = null;
      void get().refreshItems();
    }, 250);
  },

  setActiveTagId: (tagId) => {
    set({ activeTagId: tagId });
    void get().refreshItems();
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

  // ── Detail Loading (dengan stale-guard) ────────────────────
  loadItemDetail: async (id) => {
    set({ loadingDetail: true });
    try {
      const raw = await invoke<any>('get_item_detail', { id });
      // Guard: user sudah klik item lain / tutup detail → buang respons basi
      if (get().selectedItemId !== id) return null;
      if (!raw) { set({ activeItemDetail: null, loadingDetail: false }); return null; }
      // map snake_case to camelCase
      const detail: ItemDetail = {
        id: raw.id,
        type: raw.type,
        title: raw.title,
        content: raw.content ?? '',
        source: raw.source ?? 'direct',
        status: raw.status ?? 'inbox',
        favorite: !!raw.favorite,
        archived: !!raw.archived,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
        deletedAt: raw.deleted_at,
        tags: (raw.tags ?? []).map((t: any) => ({
          id: t.id, name: t.name, color: t.color ?? '#3b82f6', createdAt: t.created_at ?? '',
        })),
        task: raw.task ? {
          priority: raw.task.priority,
          completed: !!raw.task.completed,
          dueDate: raw.task.due_date,
          completedAt: raw.task.completed_at,
        } : null,
        link: raw.link ? {
          url: raw.link.url, domain: raw.link.domain,
          pageTitle: raw.link.page_title, previewImage: raw.link.preview_image,
        } : null,
        attachments: (raw.attachments ?? []).map((a: any) => ({
          id: a.id, itemId: raw.id, fileName: a.file_name,
          filePath: a.file_path, mimeType: a.mime_type,
          fileSize: a.file_size, checksum: a.checksum, createdAt: a.created_at,
          dataUrl: a.data_url ?? a.dataUrl,
        })),
        thumbnailUrl: raw.thumbnail_url ?? raw.attachments?.[0]?.data_url ?? raw.link?.preview_image ?? null,
        aiMetadata: raw.ai_metadata ? {
          id: raw.ai_metadata.id, itemId: raw.id,
          provider: raw.ai_metadata.provider, model: raw.ai_metadata.model,
          summary: raw.ai_metadata.summary, classification: raw.ai_metadata.classification,
          confidence: raw.ai_metadata.confidence, suggestedTags: raw.ai_metadata.suggested_tags,
          processedAt: raw.ai_metadata.processed_at,
        } : null,
      };
      // Double-guard sebelum commit (cek lagi setelah mapping)
      if (get().selectedItemId !== id) return null;
      set({ activeItemDetail: detail, loadingDetail: false });
      return detail;
    } catch (err) {
      console.error('Failed to load item detail:', err);
      // Hanya clear loading bila masih untuk id yang sama
      if (get().selectedItemId === id) set({ loadingDetail: false });
      return null;
    }
  },

  clearItemDetail: () => set({ activeItemDetail: null, selectedItemId: null, loadingDetail: false }),

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
    const mySeq = ++refreshSeq;
    set({ loading: true });
    const { currentView, searchQuery, activeTagId } = get();

    try {
      let rawItems: any[] = [];

      if (searchQuery.trim()) {
        // Gunakan search_items_v2 yang baru
        const results = await invoke<any[]>('search_items_v2', { query: searchQuery });
        // Buang bila sudah ada refresh lebih baru (ketik cepat)
        if (mySeq !== refreshSeq) return;
        rawItems = (results ?? []).map((r) => r.item ?? r);
      } else {
        // Gunakan get_items_summary untuk efisiensi
        const opts: Record<string, any> = {};
        if (currentView === 'trash') opts.includeTrash = true;
        else if (currentView === 'archive') opts.includeArchived = true;
        else if (currentView === 'notes') opts.filterType = 'note';
        else if (currentView === 'tasks') opts.filterType = 'task';
        else if (currentView === 'files') opts.filterType = 'file';
        else if (currentView === 'links') opts.filterType = 'link';

        rawItems = await invoke<any[]>('get_items_summary', {
          filterType: opts.filterType ?? null,
          includeTrash: opts.includeTrash ?? false,
          includeArchived: opts.includeArchived ?? false,
        });
        if (mySeq !== refreshSeq) return;
      }

      let items = (rawItems ?? []).map(mapToItemSummary);

      // Filter by tag jika ada activeTagId
      if (activeTagId) {
        items = items.filter((i) => i.tags.some((t) => t.id === activeTagId));
      }

      // Filter archived untuk view archive
      if (currentView === 'archive') {
        items = items.filter((i) => i.archived);
      }

      if (mySeq !== refreshSeq) return;
      set({ items });
    } catch (err: any) {
      if (mySeq !== refreshSeq) return;
      console.error('Failed to load items:', err);
      get().notify(`Could not load items: ${err.message ?? err}`, 'error');
    } finally {
      // Hanya clear loading bila ini request terakhir
      if (mySeq === refreshSeq) set({ loading: false });
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
      await Promise.all([get().refreshItems(), get().refreshCounts()]);
      return created;
    } catch (err: any) {
      get().notify(`Failed to save: ${err.message}`, 'error');
      throw err;
    }
  },

  updateItem: async (id, updates) => {
    try {
      const updated = await db.updateItem(id, updates);
      // Update summary di list jika masih ada
      set((state) => ({
        items: state.items.map((item) =>
          item.id === id
            ? {
                ...item,
                title: updates.title ?? item.title,
                pinned: updates.favorite !== undefined ? updates.favorite : item.pinned,
                archived: updates.archived ?? item.archived,
                task: updates.task
                  ? {
                      ...(item.task || { priority: 'medium', completed: false }),
                      ...updates.task,
                    }
                  : item.task,
              }
            : item
        ),
        // Sinkronisasi activeItemDetail jika sedang dibuka
        activeItemDetail:
          state.activeItemDetail?.id === id
            ? { ...state.activeItemDetail, ...updated }
            : state.activeItemDetail,
      }));
      if (
        updates.archived !== undefined ||
        updates.deletedAt !== undefined ||
        updates.status !== undefined
      ) {
        await get().refreshCounts();
      }
      // Jika item ini sedang dilihat, reload detail
      if (get().selectedItemId === id) {
        await get().loadItemDetail(id);
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
    await get().updateItem(id, { favorite: !item.pinned });
  },

  toggleArchive: async (id) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    const newArchived = !item.archived;
    await get().updateItem(id, { archived: newArchived });
    get().notify(newArchived ? 'Item archived' : 'Item unarchived', 'info');
    await Promise.all([get().refreshItems(), get().refreshCounts()]);
  },

  toggleTask: async (itemId, completed) => {
    const prevItems = get().items;
    const prevDetail = get().activeItemDetail;
    const nowIso = completed ? new Date().toISOString() : null;

    // Optimistic update pada item list dan active detail
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              task: item.task
                ? { ...item.task, completed, completedAt: nowIso }
                : { id: '', priority: 'medium', completed, completedAt: nowIso },
            }
          : item
      ),
      activeItemDetail:
        state.activeItemDetail?.id === itemId
          ? {
              ...state.activeItemDetail,
              task: state.activeItemDetail.task
                ? { ...state.activeItemDetail.task, completed, completedAt: nowIso }
                : { id: '', itemId, priority: 'medium', completed, completedAt: nowIso },
            }
          : state.activeItemDetail,
    }));

    try {
      await db.toggleTask(itemId, completed);
      // Jika due_date diubah / task belum selesai, reset notified
      if (!completed) {
        try {
          await invoke('reset_task_notified', { itemId });
        } catch {
          /* ignore */
        }
      }
      // Reload detail jika ini item yang aktif
      if (get().selectedItemId === itemId) {
        await get().loadItemDetail(itemId);
      }
      await get().refreshCounts();
    } catch (err: any) {
      // Rollback jika gagal
      set({ items: prevItems, activeItemDetail: prevDetail });
      get().notify(`Failed to toggle task: ${err.message}`, 'error');
    }
  },

  trashItem: async (id) => {
    // Snapshot untuk rollback bila IPC gagal (sebelumnya item hilang di UI tanpa rollback)
    const prevItems = get().items;
    const prevSelected = get().selectedItemId;
    const prevDetail = get().activeItemDetail;
    // Optimistic update
    set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
    if (get().selectedItemId === id) set({ selectedItemId: null, activeItemDetail: null });
    try {
      await db.trashItem(id);
      get().notify('Moved item to Trash', 'info');
      await get().refreshCounts();
    } catch (err: any) {
      // Rollback
      set({ items: prevItems, selectedItemId: prevSelected, activeItemDetail: prevDetail });
      get().notify(`Failed to trash item: ${err.message}`, 'error');
    }
  },

  restoreItem: async (id) => {
    try {
      await db.restoreItem(id);
      get().notify('Restored item to Inbox', 'success');
      await Promise.all([get().refreshItems(), get().refreshCounts()]);
    } catch (err: any) {
      get().notify(`Failed to restore item: ${err.message}`, 'error');
    }
  },

  permanentDeleteItem: async (id) => {
    const prevItems = get().items;
    const prevSelected = get().selectedItemId;
    const prevDetail = get().activeItemDetail;
    set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
    if (get().selectedItemId === id) set({ selectedItemId: null, activeItemDetail: null });
    try {
      await db.permanentDeleteItem(id);
      get().notify('Item permanently deleted', 'info');
      await get().refreshCounts();
    } catch (err: any) {
      set({ items: prevItems, selectedItemId: prevSelected, activeItemDetail: prevDetail });
      get().notify(`Failed to delete item: ${err.message}`, 'error');
    }
  },

  emptyTrash: async () => {
    const prevItems = get().items;
    try {
      await db.emptyTrash();
      get().notify('Trash emptied successfully', 'info');
      await Promise.all([get().refreshItems(), get().refreshCounts()]);
      set({ selectedItemId: null, activeItemDetail: null });
    } catch (err: any) {
      set({ items: prevItems });
      get().notify(`Failed to empty trash: ${err.message}`, 'error');
    }
  },

  importFilesFromPaths: async (paths) => {
    // Chunk 20 file per batch (sesuai batas Rust) agar tidak ditolak sekaligus
    const CHUNK = 20;
    const allImported: any[] = [];
    try {
      for (let i = 0; i < paths.length; i += CHUNK) {
        const chunk = paths.slice(i, i + CHUNK);
        const imported = await db.importFilesFromPaths(chunk);
        allImported.push(...imported);
      }
      get().notify(`Imported ${allImported.length} file(s) into Velco`, 'success');
      await Promise.all([get().refreshItems(), get().refreshCounts()]);
      return allImported;
    } catch (err: any) {
      // Refresh parsial agar UI konsisten walau batch gagal sebagian
      void Promise.all([get().refreshItems(), get().refreshCounts()]);
      get().notify(`Failed to import files: ${err.message}`, 'error');
      throw err;
    }
  },

  /** Bersihkan referensi tag yang dihapus dari semua items di store */
  removeTagFromItems: (tagId) => {
    set((state) => ({
      items: state.items.map((item) => ({
        ...item,
        tags: item.tags.filter((t) => t.id !== tagId),
      })),
      activeItemDetail: state.activeItemDetail
        ? {
            ...state.activeItemDetail,
            tags: state.activeItemDetail.tags.filter((t) => t.id !== tagId),
          }
        : null,
    }));
  },
}));

let crossWindowDebounceTimer: ReturnType<typeof setTimeout> | null = null;
if (typeof window !== 'undefined') {
  listen('velco://items-changed', () => {
    if (crossWindowDebounceTimer) {
      clearTimeout(crossWindowDebounceTimer);
    }
    crossWindowDebounceTimer = setTimeout(() => {
      const state = useItemStore.getState();
      void Promise.all([state.refreshItems(), state.refreshCounts()]);
    }, 250);
  }).catch(() => {
    // Graceful fallback for non-Tauri or test environments
  });
}
