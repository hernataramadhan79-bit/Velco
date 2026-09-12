import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { CapsuleRecord, CapsuleExportBundle, P2PStatus } from '../types/capsule';
import { ItemSummary } from '../types/item';

interface RawCapsule {
  id: string;
  name: string;
  description: string;
  role: string;
  encryption_key: string;
  created_at: string;
  updated_at: string;
  item_count: number;
}

function mapRawCapsule(raw: RawCapsule): CapsuleRecord {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    role: (raw.role as any) || 'Host',
    encryptionKey: raw.encryption_key,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    itemCount: raw.item_count ?? 0,
  };
}

interface CapsuleState {
  capsules: CapsuleRecord[];
  activeCapsuleId: string | null;
  capsuleItems: ItemSummary[];
  loading: boolean;
  loadingItems: boolean;

  // P2P Real-Time Live State
  p2pStatus: P2PStatus | null;
  isP2PLoading: boolean;

  refreshCapsules: () => Promise<void>;
  selectCapsule: (id: string | null) => Promise<void>;
  loadCapsuleItems: (capsuleId: string) => Promise<void>;

  createCapsule: (name: string, description?: string, role?: string) => Promise<CapsuleRecord>;
  updateCapsule: (id: string, updates: { name?: string; description?: string }) => Promise<void>;
  deleteCapsule: (id: string) => Promise<void>;
  addItemToCapsule: (capsuleId: string, itemId: string) => Promise<void>;
  removeItemFromCapsule: (capsuleId: string, itemId: string) => Promise<void>;

  exportCapsule: (capsuleId: string) => Promise<CapsuleExportBundle>;
  importCapsule: (bundleJson: string) => Promise<CapsuleRecord>;

  // P2P Methods
  startP2P: (capsuleId: string) => Promise<void>;
  stopP2P: () => Promise<void>;
  refreshP2PStatus: () => Promise<void>;
  broadcastItemUpsert: (params: {
    capsuleId: string;
    itemId: string;
    itemType: string;
    title: string;
    content: string;
    priority?: string;
    completed?: boolean;
    dueDate?: string;
  }) => Promise<void>;
  broadcastTaskToggle: (capsuleId: string, itemId: string, completed: boolean) => Promise<void>;
  broadcastItemRemoved: (capsuleId: string, itemId: string) => Promise<void>;
}

export const useCapsuleStore = create<CapsuleState>((set, get) => ({
  capsules: [],
  activeCapsuleId: null,
  capsuleItems: [],
  loading: false,
  loadingItems: false,
  p2pStatus: null,
  isP2PLoading: false,

  refreshCapsules: async () => {
    set({ loading: true });
    try {
      const rawList = await invoke<RawCapsule[]>('get_capsules');
      const capsules = (rawList || []).map(mapRawCapsule);
      
      const currentActive = get().activeCapsuleId;
      let nextActive = currentActive;
      if (!currentActive || !capsules.some((c) => c.id === currentActive)) {
        nextActive = capsules.length > 0 ? capsules[0].id : null;
      }

      set({ capsules, activeCapsuleId: nextActive, loading: false });

      if (nextActive) {
        void get().loadCapsuleItems(nextActive);
      } else {
        set({ capsuleItems: [] });
      }
    } catch (err) {
      console.error('Failed to load capsules:', err);
      set({ loading: false });
    }
  },

  selectCapsule: async (id: string | null) => {
    set({ activeCapsuleId: id });
    if (id) {
      await get().loadCapsuleItems(id);
    } else {
      set({ capsuleItems: [] });
    }
  },

  loadCapsuleItems: async (capsuleId: string) => {
    set({ loadingItems: true });
    try {
      const items = await invoke<any[]>('get_capsule_items', { capsuleId });
      const mapped: ItemSummary[] = (items || []).map((r: any) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        excerpt: r.excerpt ?? '',
        pinned: !!r.pinned,
        archived: !!r.archived,
        trashed: !!r.trashed,
        createdAt: r.created_at ?? r.createdAt ?? '',
        updatedAt: r.updated_at ?? r.updatedAt ?? '',
        tags: (r.tags ?? []).map((t: any) => ({ id: t.id, name: t.name, color: t.color ?? '#3b82f6' })),
        task: r.task
          ? {
              id: r.task.id,
              itemId: r.id,
              priority: r.task.priority ?? 'medium',
              completed: !!r.task.completed,
              dueDate: r.task.due_date ?? r.task.dueDate,
              completedAt: r.task.completed_at ?? r.task.completedAt,
            }
          : null,
        link: r.link
          ? {
              id: r.link.id,
              itemId: r.id,
              url: r.link.url,
              domain: r.link.domain ?? '',
              pageTitle: r.link.page_title ?? r.link.pageTitle ?? '',
              previewImage: r.link.preview_image ?? r.link.previewImage,
            }
          : null,
        attachmentsCount: r.attachments_count ?? 0,
        thumbnailUrl: r.thumbnail_url ?? null,
      }));

      // Guard if active capsule changed while fetching
      if (get().activeCapsuleId === capsuleId) {
        set({ capsuleItems: mapped, loadingItems: false });
      }
    } catch (err) {
      console.error('Failed to load capsule items:', err);
      if (get().activeCapsuleId === capsuleId) {
        set({ loadingItems: false });
      }
    }
  },

  createCapsule: async (name: string, description?: string, role?: string) => {
    const raw = await invoke<RawCapsule>('create_capsule', {
      name,
      description: description || '',
      role: role || 'Host',
      encryptionKey: null,
    });
    const created = mapRawCapsule(raw);
    await get().refreshCapsules();
    set({ activeCapsuleId: created.id });
    await get().loadCapsuleItems(created.id);
    return created;
  },

  updateCapsule: async (id: string, updates: { name?: string; description?: string }) => {
    await invoke('update_capsule', {
      id,
      name: updates.name,
      description: updates.description,
    });
    await get().refreshCapsules();
  },

  deleteCapsule: async (id: string) => {
    await invoke('delete_capsule', { id });
    await get().refreshCapsules();
  },

  addItemToCapsule: async (capsuleId: string, itemId: string) => {
    await invoke('add_item_to_capsule', { capsuleId, itemId });
    if (get().activeCapsuleId === capsuleId) {
      await get().loadCapsuleItems(capsuleId);
    }
  },

  removeItemFromCapsule: async (capsuleId: string, itemId: string) => {
    await invoke('remove_item_from_capsule', { capsuleId, itemId });
    if (get().activeCapsuleId === capsuleId) {
      await get().loadCapsuleItems(capsuleId);
    }
  },

  exportCapsule: async (capsuleId: string) => {
    const bundle = await invoke<any>('export_capsule', { capsuleId });
    return {
      capsule: mapRawCapsule(bundle.capsule),
      items: bundle.items,
      exportedAt: bundle.exported_at,
      version: bundle.version,
    };
  },

  importCapsule: async (bundleJson: string) => {
    const raw = await invoke<RawCapsule>('import_capsule', { bundleJson });
    const imported = mapRawCapsule(raw);
    await get().refreshCapsules();
    set({ activeCapsuleId: imported.id });
    await get().loadCapsuleItems(imported.id);
    return imported;
  },

  // ── P2P Methods ──────────────────────────────────────────
  startP2P: async (capsuleId: string) => {
    set({ isP2PLoading: true });
    try {
      const status = await invoke<P2PStatus>('start_p2p_session', { capsuleId });
      set({ p2pStatus: status, isP2PLoading: false });
    } catch (err) {
      console.error('Failed to start P2P:', err);
      set({ isP2PLoading: false });
      throw err;
    }
  },

  stopP2P: async () => {
    set({ isP2PLoading: true });
    try {
      await invoke('stop_p2p_session');
      set({ p2pStatus: null, isP2PLoading: false });
    } catch (err) {
      console.error('Failed to stop P2P:', err);
      set({ isP2PLoading: false });
      throw err;
    }
  },

  refreshP2PStatus: async () => {
    try {
      const status = await invoke<P2PStatus>('get_p2p_status');
      set({ p2pStatus: status });
    } catch (err) {
      console.error('Failed to get P2P status:', err);
    }
  },

  broadcastItemUpsert: async (params) => {
    try {
      await invoke('broadcast_p2p_item_upsert', {
        capsuleId: params.capsuleId,
        itemId: params.itemId,
        itemType: params.itemType,
        title: params.title,
        content: params.content,
        priority: params.priority || null,
        completed: params.completed ?? null,
        dueDate: params.dueDate || null,
      });
    } catch (err) {
      console.error('Failed to broadcast item upsert:', err);
    }
  },

  broadcastTaskToggle: async (capsuleId, itemId, completed) => {
    try {
      await invoke('broadcast_p2p_task_toggle', {
        capsuleId,
        itemId,
        completed,
      });
    } catch (err) {
      console.error('Failed to broadcast task toggle:', err);
    }
  },

  broadcastItemRemoved: async (capsuleId, itemId) => {
    try {
      await invoke('broadcast_p2p_item_removed', {
        capsuleId,
        itemId,
      });
    } catch (err) {
      console.error('Failed to broadcast item removed:', err);
    }
  },
}));

// Listen to backend capsule and P2P changes
if (typeof window !== 'undefined') {
  listen('velco://capsules-changed', () => {
    const store = useCapsuleStore.getState();
    void store.refreshCapsules();
    if (store.activeCapsuleId) {
      void store.loadCapsuleItems(store.activeCapsuleId);
    }
  }).catch(() => {});

  listen('velco://p2p-peer-joined', () => {
    const store = useCapsuleStore.getState();
    void store.refreshP2PStatus();
  }).catch(() => {});

  listen('velco://p2p-peer-left', () => {
    const store = useCapsuleStore.getState();
    void store.refreshP2PStatus();
  }).catch(() => {});
}
