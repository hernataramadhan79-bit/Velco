import { create } from 'zustand';
import { Tag } from '../types/item';
import { db } from '../services/database';
import { useItemStore } from './itemStore';

interface TagState {
  tags: Tag[];
  selectedTagId: string | null;
  loading: boolean;
  setSelectedTagId: (id: string | null) => void;
  refreshTags: () => Promise<void>;
  addTag: (name: string, color?: string) => Promise<Tag>;
  removeTag: (id: string) => Promise<void>;
}

/**
 * Global zustand store untuk tags — SATU sumber kebenaran.
 * Sebelumnya hook useState per-caller menyebabkan desync
 * (hapus tag di TagsView tidak hilang di Sidebar/ItemDetailModal).
 */
export const useTagStore = create<TagState>()((set, get) => ({
  tags: [],
  selectedTagId: null,
  loading: true,

  setSelectedTagId: (id) => set({ selectedTagId: id }),

  refreshTags: async () => {
    set({ loading: true });
    try {
      const list = await db.getTags();
      set({ tags: list });
    } catch (err) {
      console.error('Failed to load tags:', err);
    } finally {
      set({ loading: false });
    }
  },

  addTag: async (name: string, color?: string): Promise<Tag> => {
    const trimmed = name.trim().slice(0, 100);
    if (!trimmed) throw new Error('Tag name cannot be empty');
    const newTag = await db.createTag(trimmed, color);
    // Optimistic insert + dedup, tanpa full refetch bila bisa
    const exists = get().tags.some((t) => t.id === newTag.id);
    if (!exists) {
      set((s) => ({ tags: [...s.tags, newTag] }));
    }
    // Background re-sync agar konsisten dengan server
    get().refreshTags().catch(() => {});
    return newTag;
  },

  removeTag: async (id: string): Promise<void> => {
    const prev = get().tags;
    // Optimistic remove + rollback bila gagal
    set((s) => ({
      tags: s.tags.filter((t) => t.id !== id),
      selectedTagId: s.selectedTagId === id ? null : s.selectedTagId,
    }));
    try {
      await db.deleteTag(id);
      useItemStore.getState().removeTagFromItems(id);
    } catch (err) {
      // Rollback
      set({ tags: prev });
      throw err;
    }
  },
}));
