import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { ChatMessage, ChatChunkEvent, LlmProviderConfig } from '../types/ai';
import { StagedItem } from './contextStore';
import { aiService } from '../services/ai';
import { getSettings } from './settingsStore';

interface ChatState {
  messages: ChatMessage[];
  isGenerating: boolean;
  activeRequestId: string | null;
  estimatedTokenCount: number;
  sendMessage: (
    prompt: string,
    stagedItems: StagedItem[],
    providerConfig: LlmProviderConfig
  ) => Promise<void>;
  stopGenerating: () => void;
  clearChat: () => void;
  deleteMessage: (id: string) => void;
}

let activeUnlisten: UnlistenFn | null = null;

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      isGenerating: false,
      activeRequestId: null,
      estimatedTokenCount: 0,

      sendMessage: async (prompt: string, stagedItems: StagedItem[], providerConfig: LlmProviderConfig) => {
        const trimmed = prompt.trim();
        if (!trimmed || get().isGenerating) return;

        const currentSettings = getSettings();
        if (!currentSettings.aiEnabled || currentSettings.aiProvider === 'none') {
          console.warn('AI features are disabled in settings.');
          return;
        }

        const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const userMsgId = `msg_${Date.now()}`;
        const assistantMsgId = `msg_${Date.now() + 1}`;

        const stagedIds = stagedItems.map((i) => i.id);
        const stagedTitles = stagedItems.map((i) => i.title);

        const userMsg: ChatMessage = {
          id: userMsgId,
          role: 'user',
          content: trimmed,
          timestamp: Date.now(),
          stagedItemIds: stagedIds.length > 0 ? stagedIds : undefined,
          stagedItemTitles: stagedTitles.length > 0 ? stagedTitles : undefined,
        };

        const assistantMsg: ChatMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          stagedItemIds: stagedIds.length > 0 ? stagedIds : undefined,
          stagedItemTitles: stagedTitles.length > 0 ? stagedTitles : undefined,
          isStreaming: true,
        };

        // Prepare message payload for LLM (only role and content)
        const previousMessages = get().messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const chatPayload = [
          ...previousMessages,
          { role: 'user', content: trimmed },
        ];

        set((state) => ({
          messages: [...state.messages, userMsg, assistantMsg],
          isGenerating: true,
          activeRequestId: requestId,
        }));

        // Clean up any stale listener
        if (activeUnlisten) {
          activeUnlisten();
          activeUnlisten = null;
        }

        try {
          // Listen for token chunks emitted from Rust
          activeUnlisten = await listen<ChatChunkEvent>('ai-chat-chunk', (event) => {
            const payload = event.payload;
            if (payload.request_id !== requestId) return;

            if (payload.delta) {
              set((state) => ({
                messages: state.messages.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: msg.content + payload.delta }
                    : msg
                ),
              }));
            }

            if (payload.error) {
              set((state) => ({
                messages: state.messages.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, error: payload.error || 'An error occurred during response generation' }
                    : msg
                ),
              }));
            }

            if (payload.done) {
              set((state) => ({
                messages: state.messages.map((msg) =>
                  msg.id === assistantMsgId ? { ...msg, isStreaming: false } : msg
                ),
              }));
            }
          });

          // Invoke backend command
          const fullResponse = await aiService.executeChat(
            requestId,
            chatPayload,
            stagedIds,
            providerConfig
          );

          // Guaranteed full response update in case any chunks arrived out of order
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: msg.content.trim() ? msg.content : fullResponse,
                    isStreaming: false,
                  }
                : msg
            ),
          }));
        } catch (err: any) {
          const errorText = typeof err === 'string' ? err : err.message || 'Failed to generate response';
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, error: errorText, isStreaming: false }
                : msg
            ),
          }));
        } finally {
          if (activeUnlisten) {
            activeUnlisten();
            activeUnlisten = null;
          }
          const totalChars = get().messages.reduce((sum, m) => sum + m.content.length, 0);
          set({ isGenerating: false, activeRequestId: null, estimatedTokenCount: Math.round(totalChars / 4) });
        }
      },

      stopGenerating: () => {
        const reqId = get().activeRequestId;
        // Beritahu backend agar berhenti generate + emit (sebelumnya hanya unlisten lokal,
        // backend terus jalan dan block pesan baru).
        if (reqId) {
          invoke('cancel_chat', { requestId: reqId }).catch(() => {});
        }
        if (activeUnlisten) {
          activeUnlisten();
          activeUnlisten = null;
        }
        set((state) => ({
          isGenerating: false,
          activeRequestId: null,
          messages: state.messages.map((msg) =>
            msg.isStreaming ? { ...msg, isStreaming: false, content: msg.content || '(Generation stopped)' } : msg
          ),
        }));
      },

      clearChat: () => {
        if (activeUnlisten) {
          activeUnlisten();
          activeUnlisten = null;
        }
        set({ messages: [], isGenerating: false, activeRequestId: null, estimatedTokenCount: 0 });
      },

      deleteMessage: (id: string) => {
        set((state) => {
          const newMessages = state.messages.filter((m) => m.id !== id);
          const totalChars = newMessages.reduce((sum, m) => sum + m.content.length, 0);
          return {
            messages: newMessages,
            estimatedTokenCount: Math.round(totalChars / 4),
          };
        });
      },
    }),
    {
      name: 'velco-context-chat-storage',
      partialize: (state) => ({
        messages: state.messages.slice(-50).map((m) => ({
          ...m,
          isStreaming: false, // Ensure no lingering streaming state on rehydrate
        })),
      }),
    }
  )
);
