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

