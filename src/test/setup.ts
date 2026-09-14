import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.matchMedia
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Mock Tauri core API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd: string) => {
    if (cmd === 'get_item_counts') {
      return Promise.resolve({ inbox: 0, tasks: 0, notes: 0, files: 0, links: 0, archive: 0, trash: 0 });
    }
    if (cmd === 'get_items_summary' || cmd === 'get_capsules' || cmd === 'get_capsule_items') {
      return Promise.resolve([]);
    }
    return Promise.resolve(undefined);
  }),
}));

// Mock Tauri event API
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}));
