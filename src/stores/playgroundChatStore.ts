import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { ChatMessage, ChatChunkEvent, LlmProviderConfig } from '../types/ai';
import { ChatSessionSummary } from '../types/chat';
import { StagedItem } from './contextStore';
import { aiService } from '../services/ai';
import { chatSessionService } from '../services/chatSessionService';
import { getSettings } from './settingsStore';

// Race condition fix: Map per requestId alih-alih variabel module-level tunggal
const activeListeners = new Map<string, UnlistenFn>();

interface PlaygroundChatState {
  // Session
  activeSessionId: string | null;
  sessions: ChatSessionSummary[];

  // Messages (di-load sesuai activeSessionId)
  messages: ChatMessage[];
  isGenerating: boolean;
  activeRequestId: string | null;
  estimatedTokenCount: number;

  // Session actions
  loadSessions: () => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  newSession: () => Promise<void>;
  renameSession: (id: string, newTitle: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;

  // Messaging
  sendMessage: (
    prompt: string,
    stagedItems: StagedItem[],
    providerConfig: LlmProviderConfig
  ) => Promise<void>;
  stopGenerating: () => void;
  deleteMessage: (id: string) => void;
}

export const usePlaygroundChatStore = create<PlaygroundChatState>()(
  persist(
    (set, get) => ({
      activeSessionId: null,
      sessions: [],
      messages: [],
      isGenerating: false,
      activeRequestId: null,
      estimatedTokenCount: 0,

      // ── Session Management ─────────────────────────────────────────────

      loadSessions: async () => {
        try {
          const sessions = await chatSessionService.listSessions();
          set({ sessions });
        } catch (err) {
          console.error('[PlaygroundChat] loadSessions error:', err);
        }
      },

      switchSession: async (id: string) => {
        if (id === get().activeSessionId) return;
        try {
          const [messages, sessions] = await Promise.all([
            chatSessionService.getMessages(id),
            chatSessionService.listSessions(),
          ]);
          const chatMessages: ChatMessage[] = messages.map((m) => ({
            id: m.id,
            role: m.role as ChatMessage['role'],
            content: m.content,
            timestamp: m.timestamp,
            stagedItemIds: m.staged_item_ids
              ? (JSON.parse(m.staged_item_ids) as string[])
              : undefined,
            error: m.error ?? undefined,
            isStreaming: false,
          }));
          const totalChars = chatMessages.reduce((s, m) => s + m.content.length, 0);
          set({
            activeSessionId: id,
            messages: chatMessages,
            sessions,
            estimatedTokenCount: Math.round(totalChars / 4),
          });
        } catch (err) {
          console.error('[PlaygroundChat] switchSession error:', err);
        }
      },

      newSession: async () => {
        if (get().isGenerating) return;
        set({
          activeSessionId: null,
          messages: [],
          estimatedTokenCount: 0,
        });
      },

      renameSession: async (id: string, newTitle: string) => {
        try {
          await chatSessionService.renameSession(id, newTitle);
          const sessions = await chatSessionService.listSessions();
          set({ sessions });
        } catch (err) {
          console.error('[PlaygroundChat] renameSession error:', err);
        }
      },

      deleteSession: async (id: string) => {
        try {
          await chatSessionService.deleteSession(id);
          const sessions = await chatSessionService.listSessions();
          const wasActive = get().activeSessionId === id;
          if (wasActive) {
            // Beralih ke sesi pertama yang tersisa, atau kosongkan
            if (sessions.length > 0) {
              await get().switchSession(sessions[0].id);
            } else {
              set({ activeSessionId: null, messages: [], sessions, estimatedTokenCount: 0 });
            }
          } else {
            set({ sessions });
          }
        } catch (err) {
          console.error('[PlaygroundChat] deleteSession error:', err);
        }
      },

      // ── Messaging ──────────────────────────────────────────────────────

      sendMessage: async (
        prompt: string,
        stagedItems: StagedItem[],
        providerConfig: LlmProviderConfig
      ) => {
        const trimmed = prompt.trim();
        if (!trimmed || get().isGenerating) return;

        const currentSettings = getSettings();
        if (!currentSettings.aiEnabled || currentSettings.aiProvider === 'none') {
          console.warn('[PlaygroundChat] AI features disabled.');
          return;
        }

        // ── Lazy-create session di pesan pertama ─────────────────────────
        let sessionId = get().activeSessionId;
        if (!sessionId) {
          try {
            sessionId = await chatSessionService.createSession('playground', trimmed);
            const sessions = await chatSessionService.listSessions();
            set({ activeSessionId: sessionId, sessions });
          } catch (err) {
            console.error('[PlaygroundChat] Failed to create session:', err);
            return;
          }
        }

        const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const userMsgId = `msg_${Date.now()}`;
        const assistantMsgId = `msg_${Date.now() + 1}`;
        const stagedIds = stagedItems.map((i) => i.id);

        const userMsg: ChatMessage = {
          id: userMsgId,
          role: 'user',
          content: trimmed,
          timestamp: Date.now(),
          stagedItemIds: stagedIds.length > 0 ? stagedIds : undefined,
          stagedItemTitles: stagedItems.map((i) => i.title),
        };
        const assistantMsg: ChatMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          isStreaming: true,
        };

        const previousMessages = get().messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const chatPayload = [...previousMessages, { role: 'user', content: trimmed }];

        set((state) => ({
          messages: [...state.messages, userMsg, assistantMsg],
          isGenerating: true,
          activeRequestId: requestId,
        }));

        // ── Persist user message ke SQLite ───────────────────────────────
        chatSessionService
          .appendMessage(sessionId, 'user', trimmed, stagedIds.length > 0 ? stagedIds : null)
          .catch((e) => console.error('[PlaygroundChat] appendMessage user error:', e));

        try {
          // ── Race condition fix: listener per requestId ───────────────
          const unlisten = await listen<ChatChunkEvent>('ai-chat-chunk', (event) => {
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
                    ? { ...msg, error: payload.error ?? 'Generation error', isStreaming: false }
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

          // Simpan listener di Map — tidak bisa di-overwrite oleh request lain
          activeListeners.set(requestId, unlisten);

          const fullResponse = await aiService.executeChat(
            requestId,
            chatPayload,
            stagedIds,
            providerConfig
          );

          // Guaranteed update setelah streaming selesai
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

          // Persist assistant message ke SQLite
          const finalContent =
            get()
              .messages.find((m) => m.id === assistantMsgId)
              ?.content?.trim() || fullResponse;
          chatSessionService
            .appendMessage(sessionId!, 'assistant', finalContent, null)
            .then(async () => {
              // Refresh sessions list agar updated_at dan preview ter-update
              const sessions = await chatSessionService.listSessions();
              set({ sessions });
            })
            .catch((e) => console.error('[PlaygroundChat] appendMessage assistant error:', e));
        } catch (err: unknown) {
          const errorText =
            typeof err === 'string'
              ? err
              : err instanceof Error
              ? err.message
              : 'Failed to generate response';
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, error: errorText, isStreaming: false }
                : msg
            ),
          }));
        } finally {
          // Cleanup listener untuk requestId ini saja
          const unlisten = activeListeners.get(requestId);
          if (unlisten) {
            unlisten();
            activeListeners.delete(requestId);
          }
          const totalChars = get().messages.reduce((s, m) => s + m.content.length, 0);
          set({
            isGenerating: false,
            activeRequestId: null,
            estimatedTokenCount: Math.round(totalChars / 4),
          });
        }
      },

      stopGenerating: () => {
        const reqId = get().activeRequestId;
        if (reqId) {
          invoke('cancel_chat', { requestId: reqId }).catch(() => {});
          const unlisten = activeListeners.get(reqId);
          if (unlisten) {
            unlisten();
            activeListeners.delete(reqId);
          }
        }
        set((state) => ({
          isGenerating: false,
          activeRequestId: null,
          messages: state.messages.map((msg) =>
            msg.isStreaming
              ? { ...msg, isStreaming: false, content: msg.content || '(Generation stopped)' }
              : msg
          ),
        }));
      },

      deleteMessage: (id: string) => {
        set((state) => {
          const newMessages = state.messages.filter((m) => m.id !== id);
          const totalChars = newMessages.reduce((s, m) => s + m.content.length, 0);
          return {
            messages: newMessages,
            estimatedTokenCount: Math.round(totalChars / 4),
          };
        });
      },
    }),
    {
      name: 'velco-playground-session',
      // Hanya persist activeSessionId — messages di-load ulang dari SQLite
      partialize: (state) => ({
        activeSessionId: state.activeSessionId,
      }),
    }
  )
);
