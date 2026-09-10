import { create } from 'zustand';

export interface StagedItem {
  id: string;
  type: 'note' | 'task' | 'link' | 'file' | 'image' | 'audio';
  title: string;
  plainText: string;
  estimatedTokens: number;
}

export const estimateTokens = (text: string): number => {
  if (!text) return 0;
  // Lightweight heuristic: ~4 chars per token average
  return Math.ceil(text.length / 4);
};

export function itemToStagedItem(item: {
  id: string;
  type?: string;
  title: string;
  content?: string | null;
}): StagedItem {
  const plainText = item.content || item.title || '';
  return {
    id: item.id,
    type: (item.type as any) || 'note',
    title: item.title,
    plainText,
    estimatedTokens: estimateTokens(`${item.title}\n\n${plainText}`),
  };
}

interface ContextState {
  // ── Channel 1: Landing Hero AI Chat Context ────────────────
  chatContextItems: StagedItem[];
  addChatContextItem: (item: StagedItem) => void;
  addChatContextItems: (items: StagedItem[]) => void;
  removeChatContextItem: (id: string) => void;
  toggleChatContextItem: (item: StagedItem) => void;
  clearChatContext: () => void;
  isChatContext: (id: string) => boolean;
  totalChatTokens: () => number;

  // ── Channel 2: The Foundry Studio Context ──────────────────
  foundryStagedItems: StagedItem[];
  // Backward-compatibility alias
  stagedItems: StagedItem[];
  addFoundryItem: (item: StagedItem) => void;
  addFoundryItems: (items: StagedItem[]) => void;
  removeFoundryItem: (id: string) => void;
  toggleFoundryItem: (item: StagedItem) => void;
  clearFoundryContext: () => void;
  isFoundryStaged: (id: string) => boolean;
  totalFoundryTokens: () => number;

  // Backward-compatibility methods for The Foundry
  stageItem: (item: StagedItem) => void;
  unstageItem: (id: string) => void;
  toggleStage: (item: StagedItem) => void;
  clearStage: () => void;
  isStaged: (id: string) => boolean;
  totalTokens: () => number;

  // ── Engine Configuration ───────────────────────────────────
  activeProvider: 'local' | 'cloud' | 'ollama' | 'openai-compatible';
  activeModel: string;
  contextLimit: number;
  setActiveProvider: (provider: 'local' | 'cloud' | 'ollama' | 'openai-compatible') => void;
  setActiveModel: (model: string) => void;
}

export const useContextStore = create<ContextState>((set, get) => ({
  // ── Channel 1: Chat Context Implementation ─────────────────
  chatContextItems: [],

  addChatContextItem: (item) =>
    set((state) => ({
      chatContextItems: state.chatContextItems.some((i) => i.id === item.id)
        ? state.chatContextItems
        : [...state.chatContextItems, item],
    })),

  addChatContextItems: (newItems) =>
    set((state) => {
      const existingIds = new Set(state.chatContextItems.map((i) => i.id));
      const filtered = newItems.filter((i) => !existingIds.has(i.id));
      return {
        chatContextItems: [...state.chatContextItems, ...filtered],
      };
    }),

  removeChatContextItem: (id) =>
    set((state) => ({
      chatContextItems: state.chatContextItems.filter((i) => i.id !== id),
    })),

  toggleChatContextItem: (item) => {
    const exists = get().chatContextItems.some((i) => i.id === item.id);
    if (exists) {
      get().removeChatContextItem(item.id);
    } else {
      get().addChatContextItem(item);
    }
  },

  clearChatContext: () => set({ chatContextItems: [] }),

  isChatContext: (id) => get().chatContextItems.some((i) => i.id === id),

  totalChatTokens: () =>
    get().chatContextItems.reduce((acc, curr) => acc + curr.estimatedTokens, 0),

  // ── Channel 2: The Foundry Context Implementation ──────────
  foundryStagedItems: [],
  stagedItems: [], // Backward-compatibility alias synced with foundryStagedItems

  addFoundryItem: (item) =>
    set((state) => {
      if (state.foundryStagedItems.some((i) => i.id === item.id)) return state;
      const updated = [...state.foundryStagedItems, item];
      return { foundryStagedItems: updated, stagedItems: updated };
    }),

  addFoundryItems: (newItems) =>
    set((state) => {
      const existingIds = new Set(state.foundryStagedItems.map((i) => i.id));
      const filtered = newItems.filter((i) => !existingIds.has(i.id));
      const updated = [...state.foundryStagedItems, ...filtered];
      return { foundryStagedItems: updated, stagedItems: updated };
    }),

  removeFoundryItem: (id) =>
    set((state) => {
      const updated = state.foundryStagedItems.filter((i) => i.id !== id);
      return { foundryStagedItems: updated, stagedItems: updated };
    }),

  toggleFoundryItem: (item) => {
    const exists = get().foundryStagedItems.some((i) => i.id === item.id);
    if (exists) {
      get().removeFoundryItem(item.id);
    } else {
      get().addFoundryItem(item);
    }
  },

  clearFoundryContext: () =>
    set({ foundryStagedItems: [], stagedItems: [] }),

  isFoundryStaged: (id) => get().foundryStagedItems.some((i) => i.id === id),

  totalFoundryTokens: () =>
    get().foundryStagedItems.reduce((acc, curr) => acc + curr.estimatedTokens, 0),

  // Backward-compatibility wrappers mapping to Foundry channel
  stageItem: (item) => get().addFoundryItem(item),
  unstageItem: (id) => get().removeFoundryItem(id),
  toggleStage: (item) => get().toggleFoundryItem(item),
  clearStage: () => get().clearFoundryContext(),
  isStaged: (id) => get().isFoundryStaged(id),
  totalTokens: () => get().totalFoundryTokens(),

  // ── Engine Configuration ───────────────────────────────────
  activeProvider: 'local',
  activeModel: 'llama3:latest',
  contextLimit: 32000,
  setActiveProvider: (activeProvider) => set({ activeProvider }),
  setActiveModel: (activeModel) => set({ activeModel }),
}));
