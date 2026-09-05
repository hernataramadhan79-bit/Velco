import { Item, CreateItemInput, Tag, ItemCounts } from '../../types/item';

export interface DatabaseAdapter {
  init(): Promise<void>;
  getItemCounts(): Promise<ItemCounts>;
  getItems(options?: {
    type?: string;
    includeTrash?: boolean;
    includeArchived?: boolean;
    favoritesOnly?: boolean;
    tagId?: string;
  }): Promise<Item[]>;
  getItem(id: string): Promise<Item | null>;
  createItem(input: CreateItemInput): Promise<Item>;
  updateItem(id: string, updates: Partial<Item>): Promise<Item>;
  trashItem(id: string): Promise<void>;
  restoreItem(id: string): Promise<void>;
  permanentDeleteItem(id: string): Promise<void>;
  emptyTrash(): Promise<void>;
  toggleTask(itemId: string, completed: boolean): Promise<void>;
  getTags(): Promise<Tag[]>;
  createTag(name: string, color?: string): Promise<Tag>;
  deleteTag(id: string): Promise<void>;
  search(query: string): Promise<Item[]>;
  exportBackup(): Promise<string>;
  importBackup(jsonString: string): Promise<number>;
  importFilesFromPaths(paths: string[]): Promise<Item[]>;
}
