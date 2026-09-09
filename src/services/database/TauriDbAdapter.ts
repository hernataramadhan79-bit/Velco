import { DatabaseAdapter } from './DatabaseAdapter';
import { Item, CreateItemInput, Tag, ItemCounts } from '../../types/item';

import { invoke } from '@tauri-apps/api/core';

async function tauriInvoke<T>(cmd: string, args?: Record<string, any>): Promise<T> {
  return invoke<T>(cmd, args);
}

export class TauriDbAdapter implements DatabaseAdapter {
  async init(): Promise<void> {
    // Rust backend initializes SQLite during app startup
  }

  async getItemCounts(): Promise<ItemCounts> {
    try {
      const counts: any = await tauriInvoke('get_item_counts');
      return {
        inbox: Number(counts.inbox) || 0,
        tasks: Number(counts.tasks) || 0,
        notes: Number(counts.notes) || 0,
        files: Number(counts.files) || 0,
        links: Number(counts.links) || 0,
        archive: Number(counts.archive) || 0,
        trash: Number(counts.trash) || 0,
      };
    } catch (err) {
      console.error('Failed to get item counts:', err);
      return { inbox: 0, tasks: 0, notes: 0, files: 0, links: 0, archive: 0, trash: 0 };
    }
  }

  private mapItemRecord(r: any): Item {
    return {
      id: r.id,
      type: r.type,
      title: r.title,
      content: r.content,
      source: r.source,
      status: r.status,
      favorite: !!r.favorite,
      archived: !!r.archived,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
      tags: (r.tags || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        color: t.color || '#3b82f6',
        createdAt: r.created_at,
      })),
      task: r.task
        ? {
            priority: r.task.priority,
            completed: r.task.completed,
            dueDate: r.task.due_date,
            completedAt: r.task.completed_at,
          }
        : null,
      link: r.link
        ? {
            url: r.link.url,
            domain: r.link.domain,
            pageTitle: r.link.page_title,
            previewImage: r.link.preview_image,
          }
        : null,
      attachments: (r.attachments || []).map((a: any) => ({
        id: a.id,
        itemId: r.id,
        fileName: a.file_name,
        filePath: a.file_path,
        mimeType: a.mime_type,
        fileSize: a.file_size,
        checksum: a.checksum,
        createdAt: a.created_at,
        dataUrl: a.data_url,
      })),
      aiMetadata: r.ai_metadata
        ? {
            id: r.ai_metadata.id,
            itemId: r.ai_metadata.item_id || r.id,
            provider: r.ai_metadata.provider,
            model: r.ai_metadata.model,
            summary: r.ai_metadata.summary,
            classification: r.ai_metadata.classification,
            confidence: r.ai_metadata.confidence,
            suggestedTags: r.ai_metadata.suggested_tags,
            processedAt: r.ai_metadata.processed_at,
          }
        : null,
    };
  }

  async getItems(options?: {
    type?: string;
    includeTrash?: boolean;
    includeArchived?: boolean;
    favoritesOnly?: boolean;
    tagId?: string;
  }): Promise<Item[]> {
    const rawItems: any[] = await tauriInvoke('get_items', {
      filterType: options?.type,
      includeTrash: options?.includeTrash,
      includeArchived: options?.includeArchived,
    });

    let items: Item[] = rawItems.map((r) => this.mapItemRecord(r));

    if (options?.favoritesOnly) {
      items = items.filter((i) => i.favorite);
    }
    if (options?.tagId) {
      items = items.filter((i) => i.tags.some((t) => t.id === options.tagId));
    }
    return items;
  }

  async getItem(id: string): Promise<Item | null> {
    try {
      const res: any = await tauriInvoke('get_item', { id });
      return this.mapItemRecord(res);
    } catch {
      return null;
    }
  }

  async createItem(input: CreateItemInput): Promise<Item> {
    const attachmentsPayload = (input.attachments || []).map((a: any) => ({
      id: a.id || crypto.randomUUID(),
      file_name: a.fileName,
      file_path: a.filePath || '',
      mime_type: a.mimeType || 'application/octet-stream',
      file_size: a.fileSize || 0,
      checksum: a.checksum || 'local',
      created_at: a.createdAt || new Date().toISOString(),
      data_url: a.dataUrl,
    }));

    const res: any = await tauriInvoke('create_item', {
      payload: {
        type: input.type,
        title: input.title,
        content: input.content,
        source: input.source,
        task: input.task
          ? {
              due_date: input.task.dueDate,
              priority: input.task.priority || 'medium',
              completed: !!input.task.completed,
              completed_at: input.task.completedAt,
            }
          : undefined,
        link: input.link
          ? {
              url: input.link.url,
              domain: input.link.domain,
              page_title: input.link.pageTitle,
              preview_image: input.link.previewImage,
            }
          : undefined,
        attachments: attachmentsPayload,
        tag_ids: input.tags,
      },
    });

    return this.mapItemRecord(res);
  }

  async updateItem(id: string, updates: Partial<Item>): Promise<Item> {
    const payload: any = {
      id,
      title: updates.title,
      content: updates.content,
      favorite: updates.favorite,
      archived: updates.archived,
      status: updates.status,
    };

    if (updates.task) {
      payload.task = {
        due_date: updates.task.dueDate,
        priority: updates.task.priority,
        completed: updates.task.completed,
        completed_at: updates.task.completedAt,
      };
    }

    if (updates.tags) {
      payload.tag_ids = updates.tags.map((t) => t.id);
    }

    if (updates.aiMetadata) {
      payload.ai_metadata = {
        id: updates.aiMetadata.id || crypto.randomUUID(),
        item_id: id,
        provider: updates.aiMetadata.provider,
        model: updates.aiMetadata.model,
        summary: updates.aiMetadata.summary,
        classification: updates.aiMetadata.classification,
        confidence: updates.aiMetadata.confidence,
        suggested_tags: updates.aiMetadata.suggestedTags,
        processed_at: updates.aiMetadata.processedAt || new Date().toISOString(),
      };
    }

    const res: any = await tauriInvoke('update_item', { payload });
    return this.mapItemRecord(res);
  }

  async trashItem(id: string): Promise<void> {
    await tauriInvoke('trash_item', { id });
  }

  async restoreItem(id: string): Promise<void> {
    await tauriInvoke('restore_item', { id });
  }

  async permanentDeleteItem(id: string): Promise<void> {
    await tauriInvoke('delete_item_permanent', { id });
  }

  async emptyTrash(): Promise<void> {
    await tauriInvoke('empty_trash');
  }

  async toggleTask(itemId: string, completed: boolean): Promise<void> {
    await tauriInvoke('toggle_task_complete', { itemId, completed });
  }

  async getTags(): Promise<Tag[]> {
    const rawTags: any[] = await tauriInvoke('get_tags');
    return rawTags.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      createdAt: t.created_at,
    }));
  }

  async createTag(name: string, color?: string): Promise<Tag> {
    const res: any = await tauriInvoke('create_tag', {
      name,
      color: color || '#3b82f6',
    });
    return {
      id: res.id,
      name: res.name,
      color: res.color,
      createdAt: res.created_at,
    };
  }

  async deleteTag(id: string): Promise<void> {
    await tauriInvoke('delete_tag', { id });
  }

  async search(query: string): Promise<Item[]> {
    const rawItems: any[] = await tauriInvoke('search_items', { query });
    return rawItems.map((r) => this.mapItemRecord(r));
  }

  async exportBackup(): Promise<string> {
    return tauriInvoke<string>('export_backup');
  }

  async importBackup(jsonString: string): Promise<number> {
    // Backend kini return {imported, failed, errors} — tetap kembalikan imported agar kompatibel.
    const res: any = await tauriInvoke('import_backup', { jsonData: jsonString });
    if (typeof res === 'number') return res;
    if (res && typeof res.imported === 'number') {
      if (res.failed > 0) {
        console.warn(`Backup import: ${res.imported} ok, ${res.failed} failed`, res.errors?.slice(0, 5));
      }
      return res.imported;
    }
    return 0;
  }

  async importBackupDetailed(jsonString: string): Promise<{ imported: number; failed: number; errors: string[] }> {
    const res: any = await tauriInvoke('import_backup', { jsonData: jsonString });
    if (typeof res === 'number') return { imported: res, failed: 0, errors: [] };
    return {
      imported: Number(res?.imported) || 0,
      failed: Number(res?.failed) || 0,
      errors: Array.isArray(res?.errors) ? res.errors : [],
    };
  }

  async importFilesFromPaths(paths: string[]): Promise<Item[]> {
    const rawItems: any[] = await tauriInvoke('import_files_from_paths', { paths });
    return rawItems.map((r) => this.mapItemRecord(r));
  }

  async getItemsSummary(options?: {
    type?: string;
    includeTrash?: boolean;
    includeArchived?: boolean;
  }): Promise<import('../../types/item').ItemSummary[]> {
    const rawItems: any[] = await tauriInvoke('get_items_summary', {
      filterType: options?.type ?? null,
      includeTrash: options?.includeTrash ?? false,
      includeArchived: options?.includeArchived ?? false,
    });
    return (rawItems ?? []).map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      excerpt: r.excerpt ?? '',
      pinned: !!r.pinned,
      archived: !!r.archived,
      trashed: !!r.trashed,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      tags: (r.tags ?? []).map((t: any) => ({ id: t.id, name: t.name, color: t.color ?? '#3b82f6' })),
    }));
  }

  async getItemDetail(id: string): Promise<import('../../types/item').Item | null> {
    try {
      const res: any = await tauriInvoke('get_item_detail', { id });
      return this.mapItemRecord(res);
    } catch {
      return null;
    }
  }

  async searchItemsV2(query: string): Promise<import('../../types/item').SearchResult[]> {
    const rawResults: any[] = await tauriInvoke('search_items_v2', { query });
    return (rawResults ?? []).map((r) => ({
      item: {
        id: r.item.id,
        type: r.item.type,
        title: r.item.title,
        excerpt: r.item.excerpt ?? '',
        pinned: !!r.item.pinned,
        archived: !!r.item.archived,
        trashed: !!r.item.trashed,
        createdAt: r.item.created_at,
        updatedAt: r.item.updated_at,
        tags: (r.item.tags ?? []).map((t: any) => ({ id: t.id, name: t.name, color: t.color ?? '#3b82f6' })),
      },
      snippet: r.snippet ?? '',
      rank: r.rank ?? 0,
    }));
  }

  async exportNotes(folderPath: string, itemIds?: string[]): Promise<number> {
    return tauriInvoke<number>('export_notes_to_folder', { folderPath, itemIds });
  }

  async importFolder(folderPath: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
    return tauriInvoke('import_folder_as_notes', { folderPath });
  }

  async scanOrphanFiles(): Promise<string[]> {
    return tauriInvoke<string[]>('scan_orphan_files');
  }

  async cleanupOrphanFiles(): Promise<number> {
    return tauriInvoke<number>('cleanup_orphan_files');
  }

  async resetTaskNotified(itemId: string): Promise<void> {
    await tauriInvoke('reset_task_notified', { itemId });
  }
}
