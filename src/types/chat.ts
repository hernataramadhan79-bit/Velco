// ============================================================================
// Velco Chat Session Type Definitions
// Mirrors Rust structs in commands/chat_sessions.rs
// ============================================================================

/** Origin surface where a chat session was created */
export type ChatSessionOrigin = 'playground' | 'inbox';

/** Ringkasan sesi untuk list/dropdown history (dari list_chat_sessions) */
export interface ChatSessionSummary {
  id: string;
  title: string;
  origin: ChatSessionOrigin;
  updated_at: number; // unix ms
  created_at: number; // unix ms
  message_count: number;
  last_message_preview: string | null;
}

/** Record pesan lengkap (dari get_chat_session_messages) */
export interface ChatMessageRecord {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  staged_item_ids: string | null; // JSON-serialized string[] atau null
  error: string | null;
  timestamp: number; // unix ms
}
