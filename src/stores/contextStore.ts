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
  /** O(1) Set for fast membership checks in ItemCard */
  chatContextItemIds: Set<string>;
  addChatContextItem: (item: StagedItem) => void;
  addChatContextItems: (items: StagedItem[]) => void;
  removeChatContextItem: (id: string) => void;
  toggleChatContextItem: (item: StagedItem) => void;
  clearChatContext: () => void;
  isChatContext: (id: string) => boolean;
  totalChatTokens: () => number;

  // ── Channel 2: The Foundry Studio Context ──────────────────
  foundryStagedItems: StagedItem[];
  /** O(1) Set for fast membership checks in ItemCard */
  foundryStagedItemIds: Set<string>;
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
  chatContextItemIds: new Set<string>(),

  addChatContextItem: (item) =>
    set((state) => {
      if (state.chatContextItemIds.has(item.id)) return state;
      const chatContextItems = [...state.chatContextItems, item];
      return { chatContextItems, chatContextItemIds: new Set(chatContextItems.map((i) => i.id)) };
    }),

  addChatContextItems: (newItems) =>
    set((state) => {
      const filtered = newItems.filter((i) => !state.chatContextItemIds.has(i.id));
      const chatContextItems = [...state.chatContextItems, ...filtered];
      return { chatContextItems, chatContextItemIds: new Set(chatContextItems.map((i) => i.id)) };
    }),

  removeChatContextItem: (id) =>
    set((state) => {
      const chatContextItems = state.chatContextItems.filter((i) => i.id !== id);
      return { chatContextItems, chatContextItemIds: new Set(chatContextItems.map((i) => i.id)) };
    }),

  toggleChatContextItem: (item) => {
    const exists = get().chatContextItemIds.has(item.id);
    if (exists) {
      get().removeChatContextItem(item.id);
    } else {
      get().addChatContextItem(item);
    }
  },

  clearChatContext: () => set({ chatContextItems: [], chatContextItemIds: new Set() }),

  isChatContext: (id) => get().chatContextItemIds.has(id),

  totalChatTokens: () =>
    get().chatContextItems.reduce((acc, curr) => acc + curr.estimatedTokens, 0),

  // ── Channel 2: The Foundry Context Implementation ──────────
  foundryStagedItems: [],
  foundryStagedItemIds: new Set<string>(),
  stagedItems: [], // Backward-compatibility alias synced with foundryStagedItems

  addFoundryItem: (item) =>
    set((state) => {
      if (state.foundryStagedItemIds.has(item.id)) return state;
      const updated = [...state.foundryStagedItems, item];
      return { foundryStagedItems: updated, stagedItems: updated, foundryStagedItemIds: new Set(updated.map((i) => i.id)) };
    }),

  addFoundryItems: (newItems) =>
    set((state) => {
      const filtered = newItems.filter((i) => !state.foundryStagedItemIds.has(i.id));
      const updated = [...state.foundryStagedItems, ...filtered];
      return { foundryStagedItems: updated, stagedItems: updated, foundryStagedItemIds: new Set(updated.map((i) => i.id)) };
    }),

  removeFoundryItem: (id) =>
    set((state) => {
      const updated = state.foundryStagedItems.filter((i) => i.id !== id);
      return { foundryStagedItems: updated, stagedItems: updated, foundryStagedItemIds: new Set(updated.map((i) => i.id)) };
    }),

  toggleFoundryItem: (item) => {
    const exists = get().foundryStagedItemIds.has(item.id);
    if (exists) {
      get().removeFoundryItem(item.id);
    } else {
      get().addFoundryItem(item);
    }
  },

  clearFoundryContext: () =>
    set({ foundryStagedItems: [], stagedItems: [], foundryStagedItemIds: new Set() }),

  isFoundryStaged: (id) => get().foundryStagedItemIds.has(id),

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
