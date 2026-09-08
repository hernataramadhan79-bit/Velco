export type ItemType = 'note' | 'task' | 'link' | 'file' | 'image' | 'audio' | 'text';

export type ItemStatus = 'inbox' | 'active' | 'archived' | 'trash';

export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskMetadata {
  id?: string;
  itemId?: string;
  dueDate?: string | null;
  priority: PriorityLevel;
  completed: boolean;
  completedAt?: string | null;
}

export interface LinkMetadata {
  id?: string;
  itemId?: string;
  url: string;
  domain: string;
  pageTitle: string;
  previewImage?: string | null;
}

export interface Attachment {
  id: string;
  itemId: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
  createdAt: string;
  dataUrl?: string; // Optional local preview base64
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface ContentIndex {
  itemId: string;
  plainText: string;
  language: string;
  wordCount: number;
}

export interface AIMetadata {
  id: string;
  itemId: string;
  provider: string;
  model: string;
  summary?: string;
  classification?: string;
  suggestedTags?: string[];
  confidence?: number;
  processedAt: string;
}

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  content: string;
  source: string;
  status: ItemStatus;
  favorite: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  tags: Tag[];
  task?: TaskMetadata | null;
  link?: LinkMetadata | null;
  attachments?: Attachment[];
  thumbnailUrl?: string | null;
  aiMetadata?: AIMetadata | null;
}

export interface CreateItemInput {
  type: ItemType;
  title: string;
  content?: string;
  source?: string;
  task?: Partial<TaskMetadata>;
  link?: Partial<LinkMetadata>;
  attachments?: Partial<Attachment>[];
  tags?: string[]; // tag IDs or names
}

export interface ItemCounts {
  inbox: number;
  tasks: number;
  notes: number;
  files: number;
  links: number;
  archive: number;
  trash: number;
}

export interface TaskBatchSource {
  origin: 'ai_extract' | 'ai_chat' | 'direct';
  batchId?: string;
  batchTitle?: string;
  sourceItemId?: string;
  generatedAt?: string;
}

/**
 * Parses the item.source string.
 * Supports structured JSON string: '{"origin":"ai_extract","batchId":"...","batchTitle":"..."}'
 * or legacy strings like 'direct', 'landing_ai_chat', etc.
 */
export function parseTaskBatchSource(source?: string | null): TaskBatchSource | null {
  if (!source) return null;
  if (source.startsWith('{') && source.endsWith('}')) {
    try {
      const parsed = JSON.parse(source);
      if (parsed && typeof parsed === 'object' && parsed.origin) {
        return parsed as TaskBatchSource;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Formats a TaskBatchSource into a JSON string to store in item.source.
 */
export function formatTaskBatchSource(meta: TaskBatchSource): string {
  return JSON.stringify(meta);
}

/** Tag ringkas untuk list view */
export interface TagMinimal {
  id: string;
  name: string;
  color: string;
}

/** Item ringkas untuk list view — hanya 120 char pertama content */
export interface ItemSummary {
  id: string;
  type: ItemType;
  title: string;
  excerpt: string;
  pinned: boolean;
  archived: boolean;
  trashed: boolean;
  createdAt: string;
  updatedAt: string;
  tags: TagMinimal[];

  // Optional compatibility fields for list views and item operations
  content?: string;
  source?: string;
  status?: ItemStatus;
  favorite?: boolean;
  deletedAt?: string | null;
  task?: TaskMetadata | null;
  link?: LinkMetadata | null;
  attachments?: Attachment[];
  attachmentsCount?: number;
  thumbnailUrl?: string | null;
  aiMetadata?: AIMetadata | null;
}

/** Full item detail — dimuat saat item diklik */
export type ItemDetail = Item;

/** Hasil pencarian dengan snippet dan ranking BM25 */
export interface SearchResult {
  item: ItemSummary;
  snippet: string;
  rank: number;
}
