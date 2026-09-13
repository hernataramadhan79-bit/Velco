// Browser mock for Velco when running in standard browser/Vite dev environment
// Enables rich local interactive preview and screenshot capture without Tauri Rust backend.

if (typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window)) {
  console.info('🚀 [Velco Browser Sandbox] Initializing mock Tauri backend for web preview...');

  const mockTags = [
    { id: 'tag-1', name: 'Architecture', color: '#3b82f6', created_at: '2026-09-13T00:00:00Z' },
    { id: 'tag-2', name: 'P2P-Mesh', color: '#10b981', created_at: '2026-09-13T00:00:00Z' },
    { id: 'tag-3', name: 'Core', color: '#8b5cf6', created_at: '2026-09-13T00:00:00Z' },
    { id: 'tag-4', name: 'UI-UX', color: '#f59e0b', created_at: '2026-09-13T00:00:00Z' },
    { id: 'tag-5', name: 'Security', color: '#ef4444', created_at: '2026-09-13T00:00:00Z' },
  ];

  const mockItems = [
    {
      id: 'item-1',
      type: 'task',
      title: 'Implement zero-copy length-prefixed TCP socket for P2P sync',
      content: 'Binary framed packets for real-time Kanban state sync across local LAN without cloud servers.',
      source: 'quick_capture',
      status: 'inbox',
      favorite: 1,
      archived: 0,
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      deleted_at: null,
      tags: [mockTags[1], mockTags[2]],
      task: {
        priority: 'urgent',
        completed: false,
        due_date: new Date(Date.now() + 86400000 * 2).toISOString(),
        completed_at: null,
      },
      link: null,
      attachments: [],
      ai_metadata: null,
    },
    {
      id: 'item-2',
      type: 'task',
      title: 'Enforce React 19 unconditional hook rules in SelectionActionBar',
      content: 'Move useMemo and state hooks above conditional early returns to eliminate Minified React Error #310.',
      source: 'quick_capture',
      status: 'inbox',
      favorite: 0,
      archived: 0,
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      deleted_at: null,
      tags: [mockTags[0], mockTags[3]],
      task: {
        priority: 'high',
        completed: false,
        due_date: new Date(Date.now() + 86400000 * 3).toISOString(),
        completed_at: null,
      },
      link: null,
      attachments: [],
      ai_metadata: null,
    },
    {
      id: 'item-3',
      type: 'note',
      title: 'Velco Architectural Specification — Local-First Context Preservation',
      content: '# Velco Dual-Mode Core\n\n- **Mode 1: Personal Workstation**: Virtualized items, Studio Workbench, instant capture.\n- **Mode 2: The Bridge**: Air-gapped LAN project capsules, 3-column Kanban, AI synthesis recipes.',
      source: 'quick_capture',
      status: 'inbox',
      favorite: 1,
      archived: 0,
      created_at: new Date(Date.now() - 3600000 * 10).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 10).toISOString(),
      deleted_at: null,
      tags: [mockTags[0], mockTags[2]],
      task: null,
      link: null,
      attachments: [],
      ai_metadata: null,
    },
    {
      id: 'item-4',
      type: 'link',
      title: 'Tauri v2 Documentation — Cross-Platform Desktop Architecture',
      content: 'Official documentation for Tauri v2 native capabilities, permissions, and multi-platform packaging.',
      source: 'quick_capture',
      status: 'inbox',
      favorite: 0,
      archived: 0,
      created_at: new Date(Date.now() - 3600000 * 14).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 14).toISOString(),
      deleted_at: null,
      tags: [mockTags[0]],
      task: null,
      link: {
        url: 'https://v2.tauri.app',
        domain: 'v2.tauri.app',
        page_title: 'Tauri 2.0 — High Performance Desktop Framework',
        preview_image: null,
      },
      attachments: [],
      ai_metadata: null,
    },
    {
      id: 'item-5',
      type: 'task',
      title: 'Harden macOS Entitlements with JIT and memory unprotection flags',
      content: 'Add com.apple.security.cs.allow-jit to prevent JavaScriptCore WebKit crashes on macOS Sequoia.',
      source: 'quick_capture',
      status: 'inbox',
      favorite: 0,
      archived: 0,
      created_at: new Date(Date.now() - 3600000 * 20).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 20).toISOString(),
      deleted_at: null,
      tags: [mockTags[4]],
      task: {
        priority: 'medium',
        completed: false,
        due_date: new Date(Date.now() + 86400000 * 5).toISOString(),
        completed_at: null,
      },
      link: null,
      attachments: [],
      ai_metadata: null,
    },
    {
      id: 'item-6',
      type: 'task',
      title: 'Design dual-tab Join Capsule modal with cryptographic key handshake',
      content: 'Peer invitation key vctx_live_... alongside file bundle .vctx import tab with clear visual indicators.',
      source: 'quick_capture',
      status: 'inbox',
      favorite: 1,
      archived: 0,
      created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      deleted_at: null,
      tags: [mockTags[1], mockTags[3]],
      task: {
        priority: 'high',
        completed: true,
        due_date: new Date(Date.now() - 86400000).toISOString(),
        completed_at: new Date().toISOString(),
      },
      link: null,
      attachments: [],
      ai_metadata: null,
    },
  ];

  const mockCapsules = [
    {
      id: 'cap-1',
      name: 'Velco Multi-Platform v0.2.0',
      description: 'Universal desktop release, air-gapped P2P sync, and UI/UX ergonomics audit.',
      role: 'Host',
      encryption_key: 'vctx_live_a8f9c1e4d0b2f87a3e',
      item_count: 6,
      created_at: '2026-09-13T06:00:00Z',
      updated_at: '2026-09-13T14:30:00Z',
    },
    {
      id: 'cap-2',
      name: 'Air-Gapped Mesh Protocol',
      description: 'Zero-cloud LAN synchronization protocol running on UDP 42426 with framed TCP sockets.',
      role: 'Member',
      encryption_key: 'vctx_live_7c3b90f1a2e5d9810c',
      item_count: 4,
      created_at: '2026-09-10T10:00:00Z',
      updated_at: '2026-09-12T16:20:00Z',
    },
  ];

  const mockCapsuleItems = [
    {
      id: 'item-1',
      type: 'task',
      title: 'Implement zero-copy length-prefixed TCP socket for P2P sync',
      content: 'Binary framed packets for real-time Kanban state sync.',
      source: 'capsule',
      status: 'inbox',
      favorite: 1,
      archived: 0,
      created_at: '2026-09-13T00:00:00Z',
      updated_at: '2026-09-13T00:00:00Z',
      deleted_at: null,
      task: { priority: 'urgent', completed: false, due_date: null, completed_at: null },
      tags: [{ id: 'tag-1', name: 'Rust', color: '#ef4444' }],
      link: null,
      attachments: [],
      ai_metadata: null,
    },
    {
      id: 'item-2',
      type: 'task',
      title: 'Enforce React 19 unconditional hook rules in SelectionActionBar',
      content: 'Move useMemo and state hooks above conditional returns.',
      source: 'capsule',
      status: 'inbox',
      favorite: 0,
      archived: 0,
      created_at: '2026-09-13T00:00:00Z',
      updated_at: '2026-09-13T00:00:00Z',
      deleted_at: null,
      task: { priority: 'high', completed: false, due_date: null, completed_at: null },
      tags: [{ id: 'tag-2', name: 'React', color: '#3b82f6' }],
      link: null,
      attachments: [],
      ai_metadata: null,
    },
    {
      id: 'item-5',
      type: 'task',
      title: 'Harden macOS Entitlements with JIT and memory unprotection flags',
      content: 'Add com.apple.security.cs.allow-jit to prevent crashes.',
      source: 'capsule',
      status: 'inbox',
      favorite: 0,
      archived: 0,
      created_at: '2026-09-13T00:00:00Z',
      updated_at: '2026-09-13T00:00:00Z',
      deleted_at: null,
      task: { priority: 'medium', completed: false, due_date: null, completed_at: null },
      tags: [{ id: 'tag-5', name: 'macOS', color: '#10b981' }],
      link: null,
      attachments: [],
      ai_metadata: null,
    },
    {
      id: 'item-6',
      type: 'task',
      title: 'Design dual-tab Join Capsule modal with cryptographic key handshake',
      content: 'Peer invitation key alongside file bundle import.',
      source: 'capsule',
      status: 'inbox',
      favorite: 1,
      archived: 0,
      created_at: '2026-09-13T00:00:00Z',
      updated_at: '2026-09-13T00:00:00Z',
      deleted_at: null,
      task: { priority: 'high', completed: true, due_date: null, completed_at: new Date().toISOString() },
      tags: [{ id: 'tag-4', name: 'UI-UX', color: '#f59e0b' }],
      link: null,
      attachments: [],
      ai_metadata: null,
    },
    {
      id: 'item-3',
      type: 'note',
      title: 'Velco Architectural Specification — Local-First Context Preservation',
      content: 'Mode 1 Personal Workstation & Mode 2 The Bridge.',
      source: 'capsule',
      status: 'inbox',
      favorite: 1,
      archived: 0,
      created_at: '2026-09-13T00:00:00Z',
      updated_at: '2026-09-13T00:00:00Z',
      deleted_at: null,
      task: null,
      tags: [{ id: 'tag-3', name: 'Spec', color: '#8b5cf6' }],
      link: null,
      attachments: [],
      ai_metadata: null,
    },
  ];

  (window as any).__TAURI_INTERNALS__ = {
    invoke: async (cmd: string, _args?: any) => {
      switch (cmd) {
        case 'get_item_counts':
          return {
            inbox: mockItems.length,
            tasks: mockItems.filter((i) => i.type === 'task').length,
            notes: mockItems.filter((i) => i.type === 'note').length,
            files: 0,
            links: mockItems.filter((i) => i.type === 'link').length,
            archive: 0,
            trash: 0,
          };

        case 'get_items_summary':
        case 'get_items':
          return mockItems;

        case 'get_item_detail':
          return mockItems.find((i) => i.id === _args?.id) || mockItems[0];

        case 'get_tags':
          return mockTags;

        case 'get_capsules':
          return mockCapsules;

        case 'get_capsule_items':
          return mockCapsuleItems;

        case 'get_p2p_status':
          return {
            is_running: true,
            capsule_id: 'cap-1',
            port: 42426,
            connected_peers: 1,
            active_ip: '192.168.1.108',
            key_hash: 'vctx_live_a8f9c1e4d0b2f87a3e',
          };

        case 'plugin:event|listen':
          return () => {};

        default:
          return null;
      }
    },
    convertFileSrc: (filePath: string) => filePath,
    transformCallback: () => 0,
  };
}
