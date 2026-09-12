/**
 * Platform Detection & Keyboard Modifier Utilities
 * Dynamically detects macOS / MacBook vs Windows / Linux
 */

export const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/.test(
    navigator.userAgent || (navigator as any).userAgentData?.platform || navigator.platform || ''
  );

export const modKey = isMac ? '⌘' : 'Ctrl';
export const modKeyName = isMac ? 'Cmd' : 'Ctrl';

/**
 * Format shortcut display string
 * e.g. formatShortcut('K') -> '⌘K' on Mac, 'Ctrl+K' on Windows/Linux
 */
export function formatShortcut(key: string, withPlus = false): string {
  if (isMac) {
    return `⌘${key}`;
  }
  return withPlus ? `Ctrl+${key}` : `Ctrl+${key}`;
}
