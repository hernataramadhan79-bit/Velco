import { create } from 'zustand';

export interface StagedItem {
  id: string;
  type: 'note' | 'task' | 'link' | 'file';
  title: string;
  plainText: string;
  estimatedTokens: number;
}

interface ContextState {
  stagedItems: StagedItem[];
  activeProvider: 'local' | 'cloud' | 'ollama' | 'openai-compatible';
  activeModel: string;
  contextLimit: number;
  stageItem: (item: StagedItem) => void;
  unstageItem: (id: string) => void;
  toggleStage: (item: StagedItem) => void;
  clearStage: () => void;
  isStaged: (id: string) => boolean;
  totalTokens: () => number;
  setActiveProvider: (provider: 'local' | 'cloud' | 'ollama' | 'openai-compatible') => void;
  setActiveModel: (model: string) => void;
}

export const estimateTokens = (text: string): number => {
  if (!text) return 0;
  // Lightweight heuristic: ~4 chars per token average
  return Math.ceil(text.length / 4);
};

export const useContextStore = create<ContextState>((set, get) => ({
  stagedItems: [],
  activeProvider: 'local',
  activeModel: 'llama3:latest',
  contextLimit: 32000,
  stageItem: (item) =>
    set((state) => ({
      stagedItems: state.stagedItems.some((i) => i.id === item.id)
        ? state.stagedItems
        : [...state.stagedItems, item],
    })),
  unstageItem: (id) =>
    set((state) => ({
      stagedItems: state.stagedItems.filter((i) => i.id !== id),
    })),
  toggleStage: (item) => {
    const isStaged = get().stagedItems.some((i) => i.id === item.id);
    if (isStaged) {
      get().unstageItem(item.id);
    } else {
      get().stageItem(item);
    }
  },
  clearStage: () => set({ stagedItems: [] }),
  isStaged: (id) => get().stagedItems.some((i) => i.id === id),
  totalTokens: () =>
    get().stagedItems.reduce((acc, curr) => acc + curr.estimatedTokens, 0),
  setActiveProvider: (activeProvider) => set({ activeProvider }),
  setActiveModel: (activeModel) => set({ activeModel }),
}));
