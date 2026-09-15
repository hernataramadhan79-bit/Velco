import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.matchMedia and element measurements for JSDOM
if (typeof window !== 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

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

  Element.prototype.getBoundingClientRect = () => ({
    width: 1024,
    height: 800,
    top: 0,
    left: 0,
    bottom: 800,
    right: 1024,
    x: 0,
    y: 0,
    toJSON: () => {},
  });

  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 1024 });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 1024 });
}

// Mock Tauri core API
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn().mockImplementation((filePath: string) => filePath),
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
