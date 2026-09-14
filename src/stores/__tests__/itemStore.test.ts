import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useItemStore } from '../itemStore';
import { invoke } from '@tauri-apps/api/core';

describe('itemStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useItemStore.setState({
      appMode: 'personal',
      items: [],
      archiveItems: [],
      trashItems: [],
      activeItemDetail: null,
      selectedItemId: null,
      currentView: 'inbox',
      searchQuery: '',
      notification: null,
      loading: false,
    });
  });

  it('updates appMode correctly', () => {
    expect(useItemStore.getState().appMode).toBe('personal');
    useItemStore.getState().setAppMode('context-hub');
    expect(useItemStore.getState().appMode).toBe('context-hub');
  });

  it('sets navigation view and updates currentView', () => {
    useItemStore.getState().setCurrentView('tasks');
    expect(useItemStore.getState().currentView).toBe('tasks');
    expect(useItemStore.getState().activeItemDetail).toBeNull();

    useItemStore.getState().setSelectedItemId('item-123');
    expect(useItemStore.getState().selectedItemId).toBe('item-123');
    useItemStore.getState().setSelectedItemId(null);
    expect(useItemStore.getState().selectedItemId).toBeNull();
  });

  it('triggers notification and dismisses it', () => {
    useItemStore.getState().notify('Test notification', 'info');
    expect(useItemStore.getState().notification).toEqual({
      message: 'Test notification',
      type: 'info',
    });

    useItemStore.getState().dismissNotification();
    expect(useItemStore.getState().notification).toBeNull();
  });

  it('captures an item and updates items in state', async () => {
    const mockCreated = {
      id: 'new-note-1',
      type: 'note',
      title: 'Captured Note',
      content: 'Hello world',
      source: 'direct',
      status: 'inbox',
      favorite: false,
      pinned: false,
      archived: false,
      trashed: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      deletedAt: null,
      tags: [],
      task: null,
      link: null,
      attachments: [],
      aiMetadata: null,
    };

    vi.mocked(invoke).mockResolvedValueOnce(mockCreated);

    const result = await useItemStore.getState().captureItem({
      type: 'note',
      title: 'Captured Note',
      content: 'Hello world',
    });

    expect(result.id).toBe('new-note-1');
    expect(invoke).toHaveBeenCalledWith('create_item', expect.any(Object));
  });

  it('trashes an item and moves it to trashItems', async () => {
    const initialItem = {
      id: 'item-to-trash',
      type: 'note' as const,
      title: 'To Trash',
      excerpt: '...',
      pinned: false,
      archived: false,
      trashed: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      tags: [],
      task: null,
      link: null,
      attachmentsCount: 0,
      thumbnailUrl: null,
    };

    useItemStore.setState({
      items: [initialItem],
      trashItems: [],
    });

    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    await useItemStore.getState().trashItem('item-to-trash');

    expect(useItemStore.getState().items.find((i) => i.id === 'item-to-trash')).toBeUndefined();
    expect(useItemStore.getState().trashItems.find((i) => i.id === 'item-to-trash')).toBeDefined();
    expect(invoke).toHaveBeenCalledWith('trash_item', { id: 'item-to-trash' });
  });
});
