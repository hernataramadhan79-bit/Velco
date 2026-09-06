import { open } from '@tauri-apps/plugin-shell';

/**
 * Safely opens an external URL using the system's default browser via Tauri shell plugin,
 * with a graceful browser window.open fallback.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;
  try {
    await open(url);
  } catch (err) {
    console.warn('Tauri open failed, falling back to window.open:', err);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
}
