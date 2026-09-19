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

  // ── Channel 2: Workbench Studio Context ──────────────────
  workbenchItems: StagedItem[];
  /** O(1) Set for fast membership checks in ItemCard */
  workbenchItemIds: Set<string>;
  // Backward-compatibility alias
  stagedItems: StagedItem[];
  addWorkbenchItem: (item: StagedItem) => void;
  addWorkbenchItems: (items: StagedItem[]) => void;
  removeWorkbenchItem: (id: string) => void;
  toggleWorkbenchItem: (item: StagedItem) => void;
  clearWorkbenchContext: () => void;
  isWorkbenchStaged: (id: string) => boolean;
  totalWorkbenchTokens: () => number;

  // Backward-compatibility methods for Workbench
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

  // ── Channel 2: Workbench Context Implementation ──────────
  workbenchItems: [],
  workbenchItemIds: new Set<string>(),
  stagedItems: [], // Backward-compatibility alias synced with workbenchItems

  addWorkbenchItem: (item) =>
    set((state) => {
      if (state.workbenchItemIds.has(item.id)) return state;
      const updated = [...state.workbenchItems, item];
      return { workbenchItems: updated, stagedItems: updated, workbenchItemIds: new Set(updated.map((i) => i.id)) };
    }),

  addWorkbenchItems: (newItems) =>
    set((state) => {
      const filtered = newItems.filter((i) => !state.workbenchItemIds.has(i.id));
      const updated = [...state.workbenchItems, ...filtered];
      return { workbenchItems: updated, stagedItems: updated, workbenchItemIds: new Set(updated.map((i) => i.id)) };
    }),

  removeWorkbenchItem: (id) =>
    set((state) => {
      const updated = state.workbenchItems.filter((i) => i.id !== id);
      return { workbenchItems: updated, stagedItems: updated, workbenchItemIds: new Set(updated.map((i) => i.id)) };
    }),

  toggleWorkbenchItem: (item) => {
    const exists = get().workbenchItemIds.has(item.id);
    if (exists) {
      get().removeWorkbenchItem(item.id);
    } else {
      get().addWorkbenchItem(item);
    }
  },

  clearWorkbenchContext: () =>
    set({ workbenchItems: [], stagedItems: [], workbenchItemIds: new Set() }),

  isWorkbenchStaged: (id) => get().workbenchItemIds.has(id),

  totalWorkbenchTokens: () =>
    get().workbenchItems.reduce((acc, curr) => acc + curr.estimatedTokens, 0),

  // Backward-compatibility wrappers mapping to Workbench channel
  stageItem: (item) => get().addWorkbenchItem(item),
  unstageItem: (id) => get().removeWorkbenchItem(id),
  toggleStage: (item) => get().toggleWorkbenchItem(item),
  clearStage: () => get().clearWorkbenchContext(),
  isStaged: (id) => get().isWorkbenchStaged(id),
  totalTokens: () => get().totalWorkbenchTokens(),

  // ── Engine Configuration ───────────────────────────────────
  activeProvider: 'local',
  activeModel: 'llama3:latest',
  contextLimit: 32000,
  setActiveProvider: (activeProvider) => set({ activeProvider }),
  setActiveModel: (activeModel) => set({ activeModel }),
}));
