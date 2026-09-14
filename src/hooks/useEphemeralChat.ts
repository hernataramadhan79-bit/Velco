import { useState, useCallback, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { ChatMessage, ChatChunkEvent, LlmProviderConfig } from '../types/ai';
import { StagedItem } from '../stores/contextStore';
import { aiService } from '../services/ai';
import { chatSessionService } from '../services/chatSessionService';
import { getSettings } from '../stores/settingsStore';

/**
 * useEphemeralChat — hook untuk sesi chat ephemeral di Inbox (LandingHeroAiChat).
 *
 * - State lokal (useState), BUKAN Zustand persist
 * - sessionId null sampai pesan pertama dikirim, lalu di-create via backend
 * - State reset otomatis saat komponen unmount (karena hanya local state)
 * - Race condition fix: Map<requestId, UnlistenFn> per panggilan sendMessage
 * - stagedItems tetap kompatibel dengan contextStore
 */
export function useEphemeralChat() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  // Map per-request listener — tidak bisa di-overwrite
  const listenersRef = useRef<Map<string, UnlistenFn>>(new Map());

  const sendMessage = useCallback(
    async (
      prompt: string,
      stagedItems: StagedItem[],
      providerConfig: LlmProviderConfig
    ): Promise<void> => {
      const trimmed = prompt.trim();
      if (!trimmed || isGenerating) return;

      const currentSettings = getSettings();
      if (!currentSettings.aiEnabled || currentSettings.aiProvider === 'none') {
        console.warn('[EphemeralChat] AI features disabled.');
        return;
      }

      // ── Lazy-create sesi di pesan pertama ─────────────────────────────
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        try {
          currentSessionId = await chatSessionService.createSession('inbox', trimmed);
          setSessionId(currentSessionId);
        } catch (err) {
          console.error('[EphemeralChat] Failed to create session:', err);
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

      // Build chat history untuk LLM
      const previousMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const chatPayload = [...previousMessages, { role: 'user', content: trimmed }];

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsGenerating(true);
      setActiveRequestId(requestId);

      // Persist user message ke SQLite (fire-and-forget)
      chatSessionService
        .appendMessage(currentSessionId, 'user', trimmed, stagedIds.length > 0 ? stagedIds : null)
        .catch((e) => console.error('[EphemeralChat] appendMessage user error:', e));

      let finalContent = '';

      try {
        // ── Race condition fix: listener per requestId ─────────────────
        const unlisten = await listen<ChatChunkEvent>('ai-chat-chunk', (event) => {
          const payload = event.payload;
          if (payload.request_id !== requestId) return;

          if (payload.delta) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? { ...msg, content: msg.content + payload.delta }
                  : msg
              )
            );
            finalContent += payload.delta;
          }

          if (payload.error) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? { ...msg, error: payload.error ?? 'Generation error', isStreaming: false }
                  : msg
              )
            );
          }

          if (payload.done) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, isStreaming: false } : msg
              )
            );
          }
        });

        listenersRef.current.set(requestId, unlisten);

        const fullResponse = await aiService.executeChat(
          requestId,
          chatPayload,
          stagedIds,
          providerConfig
        );

        // Guaranteed update
        const resolvedContent = finalContent.trim() || fullResponse;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: resolvedContent, isStreaming: false }
              : msg
          )
        );

        // Persist assistant message ke SQLite (fire-and-forget)
        chatSessionService
          .appendMessage(currentSessionId!, 'assistant', resolvedContent, null)
          .catch((e) => console.error('[EphemeralChat] appendMessage assistant error:', e));
      } catch (err: unknown) {
        const errorText =
          typeof err === 'string'
            ? err
            : err instanceof Error
            ? err.message
            : 'Failed to generate response';
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, error: errorText, isStreaming: false }
              : msg
          )
        );
      } finally {
        // Cleanup listener hanya untuk requestId ini
        const unlisten = listenersRef.current.get(requestId);
        if (unlisten) {
          unlisten();
          listenersRef.current.delete(requestId);
        }
        setIsGenerating(false);
        setActiveRequestId(null);
      }
    },
    [sessionId, isGenerating, messages]
  );

  const stopGenerating = useCallback(() => {
    if (activeRequestId) {
      invoke('cancel_chat', { requestId: activeRequestId }).catch(() => {});
      const unlisten = listenersRef.current.get(activeRequestId);
      if (unlisten) {
        unlisten();
        listenersRef.current.delete(activeRequestId);
      }
    }
    setIsGenerating(false);
    setActiveRequestId(null);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.isStreaming
          ? { ...msg, isStreaming: false, content: msg.content || '(Generation stopped)' }
          : msg
      )
    );
  }, [activeRequestId]);

  const clearChat = useCallback(() => {
    stopGenerating();
    setSessionId(null);
    setMessages([]);
  }, [stopGenerating]);

  return {
    sessionId,
    messages,
    isGenerating,
    activeRequestId,
    sendMessage,
    stopGenerating,
    clearChat,
  };
}
