import { invoke } from '@tauri-apps/api/core';
import { ChatSessionSummary, ChatMessageRecord, ChatSessionOrigin } from '../types/chat';

/**
 * chatSessionService — thin IPC wrapper over Rust chat_sessions commands.
 * Semua persistence logic ada di Rust/SQLite, bukan di sini.
 */
export const chatSessionService = {
  /**
   * Buat sesi baru. first_message (opsional) dipakai untuk auto-generate judul.
   * Returns session ID string.
   */
  createSession: (origin: ChatSessionOrigin, firstMessage?: string): Promise<string> =>
    invoke<string>('create_chat_session', {
      origin,
      firstMessage: firstMessage ?? null,
    }),

  /**
   * Append pesan ke sesi yang sudah ada.
   * staged_item_ids dikirim sebagai JSON string (atau null).
   * Returns message ID string.
   */
  appendMessage: (
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    stagedItemIds?: string[] | null
  ): Promise<string> =>
    invoke<string>('append_chat_message', {
      sessionId,
      role,
      content,
      stagedItemIds:
        stagedItemIds && stagedItemIds.length > 0
          ? JSON.stringify(stagedItemIds)
          : null,
    }),

  /**
   * List semua sesi, diurutkan updated_at DESC.
   */
  listSessions: (): Promise<ChatSessionSummary[]> =>
    invoke<ChatSessionSummary[]>('list_chat_sessions'),

  /**
   * Ambil semua pesan dalam satu sesi.
   */
  getMessages: (sessionId: string): Promise<ChatMessageRecord[]> =>
    invoke<ChatMessageRecord[]>('get_chat_session_messages', { sessionId }),

  /**
   * Rename judul sesi.
   */
  renameSession: (sessionId: string, newTitle: string): Promise<void> =>
    invoke<void>('rename_chat_session', { sessionId, newTitle }),

  /**
   * Hapus sesi beserta semua pesannya (ON DELETE CASCADE di SQLite).
   */
  deleteSession: (sessionId: string): Promise<void> =>
    invoke<void>('delete_chat_session', { sessionId }),

  /**
   * One-time migration dari localStorage velco-context-chat-storage.
   * Frontend membaca localStorage dan mengirimkan string JSON ke Rust.
   * Returns true jika migrasi baru dijalankan.
   */
  migrateLegacy: (serializedMessages: string): Promise<boolean> =>
    invoke<boolean>('migrate_legacy_chat', { serializedMessages }),
};
