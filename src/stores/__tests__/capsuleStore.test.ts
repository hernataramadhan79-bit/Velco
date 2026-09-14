import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCapsuleStore } from '../capsuleStore';
import { invoke } from '@tauri-apps/api/core';

describe('capsuleStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCapsuleStore.setState({
      capsules: [],
      activeCapsuleId: null,
      capsuleItems: [],
      loading: false,
      loadingItems: false,
      p2pStatus: null,
      isP2PLoading: false,
    });
  });

  it('selects capsule and triggers item loading', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([]);

    await useCapsuleStore.getState().selectCapsule('cap-456');

    expect(useCapsuleStore.getState().activeCapsuleId).toBe('cap-456');
    expect(invoke).toHaveBeenCalledWith('get_capsule_items', { capsuleId: 'cap-456' });
  });

  it('creates capsule and updates active capsule', async () => {
    const mockRawCapsule = {
      id: 'cap-new-1',
      name: 'Design System',
      description: 'UI Design tokens',
      role: 'Host',
      encryption_key: 'vctx_live_key',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      item_count: 0,
    };

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'create_capsule') return mockRawCapsule;
      if (cmd === 'get_capsules') return [mockRawCapsule];
      if (cmd === 'get_capsule_items') return [];
      return undefined;
    });

    const created = await useCapsuleStore.getState().createCapsule('Design System', 'UI Design tokens');

    expect(created.id).toBe('cap-new-1');
    expect(created.name).toBe('Design System');
    expect(useCapsuleStore.getState().activeCapsuleId).toBe('cap-new-1');
    expect(useCapsuleStore.getState().capsules).toHaveLength(1);
  });

  it('updates capsule and calls update_capsule command', async () => {
    const originalCapsule = {
      id: 'cap-1',
      name: 'New Name',
      description: 'Old Desc',
      role: 'Host',
      encryption_key: 'key',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      item_count: 0,
    };

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'update_capsule') return undefined;
      if (cmd === 'get_capsules') return [originalCapsule];
      return undefined;
    });

    await useCapsuleStore.getState().updateCapsule('cap-1', { name: 'New Name' });

    const updated = useCapsuleStore.getState().capsules.find((c) => c.id === 'cap-1');
    expect(updated?.name).toBe('New Name');
    expect(invoke).toHaveBeenCalledWith('update_capsule', {
      id: 'cap-1',
      name: 'New Name',
      description: undefined,
    });
  });

  it('deletes capsule and unsets activeCapsuleId if active was deleted', async () => {
    useCapsuleStore.setState({
      capsules: [
        {
          id: 'cap-to-del',
          name: 'Delete Me',
          description: '',
          role: 'Host',
          encryptionKey: 'key',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          itemCount: 0,
        },
      ],
      activeCapsuleId: 'cap-to-del',
    });

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'delete_capsule') return undefined;
      if (cmd === 'get_capsules') return [];
      return undefined;
    });

    await useCapsuleStore.getState().deleteCapsule('cap-to-del');

    expect(useCapsuleStore.getState().capsules).toHaveLength(0);
    expect(useCapsuleStore.getState().activeCapsuleId).toBeNull();
    expect(invoke).toHaveBeenCalledWith('delete_capsule', { id: 'cap-to-del' });
  });
});
