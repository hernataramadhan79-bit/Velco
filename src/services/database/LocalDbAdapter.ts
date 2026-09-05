import { DatabaseAdapter } from './DatabaseAdapter';
import { Item, CreateItemInput, Tag, ItemType, PriorityLevel, ItemCounts } from '../../types/item';

const DB_NAME = 'LifeInboxLocalDB';
const DB_VERSION = 1;

export class LocalDbAdapter implements DatabaseAdapter {
  private db: IDBDatabase | null = null;
  private isSeeding = false;

  async getItemCounts(): Promise<ItemCounts> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore('items', 'readonly');
      const req = store.getAll();

      req.onsuccess = () => {
        const all: Item[] = req.result || [];
        const counts: ItemCounts = {
          inbox: all.filter((i) => !i.deletedAt && !i.archived && i.status === 'inbox').length,
          tasks: all.filter((i) => !i.deletedAt && !i.archived && i.type === 'task').length,
          notes: all.filter((i) => !i.deletedAt && !i.archived && i.type === 'note').length,
          files: all.filter((i) => !i.deletedAt && !i.archived && (i.type === 'file' || i.type === 'image')).length,
          links: all.filter((i) => !i.deletedAt && !i.archived && i.type === 'link').length,
          archive: all.filter((i) => !i.deletedAt && i.archived).length,
          trash: all.filter((i) => i.deletedAt != null).length,
        };
        resolve(counts);
      };

      req.onerror = () => reject(req.error);
    });
  }

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('items')) {
          const itemStore = db.createObjectStore('items', { keyPath: 'id' });
          itemStore.createIndex('type', 'type', { unique: false });
          itemStore.createIndex('createdAt', 'createdAt', { unique: false });
          itemStore.createIndex('deletedAt', 'deletedAt', { unique: false });
          itemStore.createIndex('favorite', 'favorite', { unique: false });
        }

        if (!db.objectStoreNames.contains('tags')) {
          const tagStore = db.createObjectStore('tags', { keyPath: 'id' });
          tagStore.createIndex('name', 'name', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.seedInitialDataIfEmpty().finally(() => resolve());
      };

      request.onerror = () => {
        reject(new Error('Failed to open local IndexedDB database'));
      };
    });
  }

  private async seedInitialDataIfEmpty(): Promise<void> {
    if (this.isSeeding) return;
    this.isSeeding = true;
    try {
      const items = await this.getItems({ includeTrash: true });
      if (items.length > 0) return;

      // Seed welcoming initial notes and tags to wow user on first launch
      const tagIdeas = await this.createTag('Ideas', '#3b82f6');
      const tagImportant = await this.createTag('Important', '#ef4444');
      const tagInbox = await this.createTag('Inbox', '#10b981');

      await this.createItem({
        type: 'note',
        title: 'Welcome to Life Inbox',
        content:
          '# Capture First. Organize Later.\n\nLife Inbox is your local-first personal inbox.\n\n- Save notes, tasks, links, and files with zero friction.\n- Use **Ctrl+K** or the search bar for instant local search.\n- AI features (summarization, tag suggestions, Q&A) are strictly optional and run locally via Ollama when configured.\n\nNo accounts, no clouds, 100% private.',
        tags: [tagInbox.id, tagIdeas.id],
      });

      await this.createItem({
        type: 'task',
        title: 'Explore Life Inbox settings and universal capture',
        task: {
          priority: 'high' as PriorityLevel,
          completed: false,
          dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
        },
        tags: [tagImportant.id],
      });

      await this.createItem({
        type: 'link',
        title: 'Local AI with Ollama',
        content: 'Get started with open source local LLMs on your computer.',
        link: {
          url: 'https://ollama.com',
          domain: 'ollama.com',
          pageTitle: 'Ollama — Get up and running with Llama, Mistral, and Qwen locally',
        },
        tags: [tagIdeas.id],
      });
    } catch {
      // Ignore seed conflicts
    } finally {
      this.isSeeding = false;
    }
  }

  private getStore(storeName: string, mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error('Database not initialized');
    const tx = this.db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  async getItems(options?: {
    type?: string;
    includeTrash?: boolean;
    includeArchived?: boolean;
    favoritesOnly?: boolean;
    tagId?: string;
  }): Promise<Item[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore('items', 'readonly');
      const req = store.getAll();

      req.onsuccess = () => {
        let results: Item[] = req.result || [];

        if (options?.includeTrash) {
          results = results.filter((item) => item.deletedAt != null);
        } else {
          results = results.filter((item) => item.deletedAt == null);

          if (!options?.includeArchived) {
            results = results.filter((item) => !item.archived);
          }
        }

        if (options?.type) {
          results = results.filter((item) => item.type === options.type);
        }

        if (options?.favoritesOnly) {
          results = results.filter((item) => item.favorite);
        }

        if (options?.tagId) {
          results = results.filter((item) =>
            item.tags.some((t) => t.id === options.tagId)
          );
        }

        // Sort descending by createdAt
        results.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        resolve(results);
      };

      req.onerror = () => reject(req.error);
    });
  }

  async getItem(id: string): Promise<Item | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore('items', 'readonly');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async createItem(input: CreateItemInput): Promise<Item> {
    await this.init();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Resolve tags if provided as IDs
    let resolvedTags: Tag[] = [];
    if (input.tags && input.tags.length > 0) {
      const allTags = await this.getTags();
      resolvedTags = allTags.filter((t) => input.tags?.includes(t.id) || input.tags?.includes(t.name));
    }

    const newItem: Item = {
      id,
      type: input.type,
      title: input.title.trim(),
      content: input.content || '',
      source: input.source || 'direct',
      status: 'inbox',
      favorite: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      tags: resolvedTags,
      task: input.task
        ? {
            priority: input.task.priority || 'medium',
            completed: !!input.task.completed,
            dueDate: input.task.dueDate || null,
            completedAt: input.task.completed ? now : null,
          }
        : null,
      link: input.link
        ? {
            url: input.link.url || '',
            domain: input.link.domain || this.extractDomain(input.link.url || ''),
            pageTitle: input.link.pageTitle || input.title,
            previewImage: input.link.previewImage || null,
          }
        : null,
      attachments: (input.attachments as any[]) || [],
      aiMetadata: null,
    };

    return new Promise((resolve, reject) => {
      const store = this.getStore('items', 'readwrite');
      const req = store.add(newItem);
      req.onsuccess = () => resolve(newItem);
      req.onerror = () => reject(req.error);
    });
  }

  private extractDomain(url: string): string {
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  async updateItem(id: string, updates: Partial<Item>): Promise<Item> {
    const existing = await this.getItem(id);
    if (!existing) throw new Error(`Item ${id} not found`);

    const updated: Item = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const store = this.getStore('items', 'readwrite');
      const req = store.put(updated);
      req.onsuccess = () => resolve(updated);
      req.onerror = () => reject(req.error);
    });
  }

  async trashItem(id: string): Promise<void> {
    await this.updateItem(id, { deletedAt: new Date().toISOString() });
  }

  async restoreItem(id: string): Promise<void> {
    await this.updateItem(id, { deletedAt: null });
  }

  async permanentDeleteItem(id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore('items', 'readwrite');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async toggleTask(itemId: string, completed: boolean): Promise<void> {
    const item = await this.getItem(itemId);
    if (!item) return;

    const taskMeta = item.task || {
      priority: 'medium' as PriorityLevel,
      completed: false,
      dueDate: null,
    };

    taskMeta.completed = completed;
    taskMeta.completedAt = completed ? new Date().toISOString() : null;

    await this.updateItem(itemId, { task: taskMeta });
  }

  async getTags(): Promise<Tag[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore('tags', 'readonly');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async createTag(name: string, color?: string): Promise<Tag> {
    await this.init();
    const existing = (await this.getTags()).find(
      (t) => t.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (existing) return existing;

    const newTag: Tag = {
      id: crypto.randomUUID(),
      name: name.trim(),
      color: color || '#3b82f6',
      createdAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const store = this.getStore('tags', 'readwrite');
      const req = store.add(newTag);
      req.onsuccess = () => resolve(newTag);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteTag(id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const store = this.getStore('tags', 'readwrite');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async search(query: string): Promise<Item[]> {
    const q = query.toLowerCase().trim();
    if (!q) return this.getItems();

    const all = await this.getItems({ includeTrash: false });
    return all.filter((item) => {
      return (
        item.title.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q) ||
        (item.link?.url && item.link.url.toLowerCase().includes(q)) ||
        (item.link?.domain && item.link.domain.toLowerCase().includes(q)) ||
        item.tags.some((t) => t.name.toLowerCase().includes(q)) ||
        (item.attachments &&
          item.attachments.some((a) => a.fileName.toLowerCase().includes(q)))
      );
    });
  }

  async exportBackup(): Promise<string> {
    const items = await this.getItems({ includeTrash: true });
    const tags = await this.getTags();
    const payload = {
      app: 'LifeInbox',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      items,
      tags,
    };
    return JSON.stringify(payload, null, 2);
  }

  async importBackup(jsonString: string): Promise<number> {
    const data = JSON.parse(jsonString);
    if (!data.items || !Array.isArray(data.items)) {
      throw new Error('Invalid backup file format: missing items array');
    }

    await this.init();
    let count = 0;

    if (data.tags && Array.isArray(data.tags)) {
      for (const t of data.tags) {
        await this.createTag(t.name, t.color);
      }
    }

    for (const item of data.items) {
      await new Promise<void>((resolve, reject) => {
        const store = this.getStore('items', 'readwrite');
        const req = store.put(item);
        req.onsuccess = () => {
          count++;
          resolve();
        };
        req.onerror = () => reject(req.error);
      });
    }

    return count;
  }
}
