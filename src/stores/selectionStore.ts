import { create } from 'zustand';

interface SelectionState {
  selectedIds: Set<string>;
  toggleSelectItem: (id: string) => void;
  selectItem: (id: string) => void;
  deselectItem: (id: string) => void;
  selectMultiple: (ids: string[]) => void;
  deselectMultiple: (ids: string[]) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  isItemSelected: (id: string) => boolean;
  getSelectedCount: () => number;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedIds: new Set<string>(),

  toggleSelectItem: (id: string) => {
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next };
    });
  },

  selectItem: (id: string) => {
    set((state) => {
      if (state.selectedIds.has(id)) return state;
      const next = new Set(state.selectedIds);
      next.add(id);
      return { selectedIds: next };
    });
  },

  deselectItem: (id: string) => {
    set((state) => {
      if (!state.selectedIds.has(id)) return state;
      const next = new Set(state.selectedIds);
      next.delete(id);
      return { selectedIds: next };
    });
  },

  selectMultiple: (ids: string[]) => {
    set((state) => {
      const next = new Set(state.selectedIds);
      for (const id of ids) {
        next.add(id);
      }
      return { selectedIds: next };
    });
  },

  deselectMultiple: (ids: string[]) => {
    set((state) => {
      const next = new Set(state.selectedIds);
      for (const id of ids) {
        next.delete(id);
      }
      return { selectedIds: next };
    });
  },

  selectAll: (ids: string[]) => {
    set({ selectedIds: new Set(ids) });
  },

  clearSelection: () => {
    set({ selectedIds: new Set() });
  },

  isItemSelected: (id: string) => get().selectedIds.has(id),

  getSelectedCount: () => get().selectedIds.size,
}));
