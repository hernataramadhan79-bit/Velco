import { open } from '@tauri-apps/plugin-shell';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** Validasi ulang URL sebelum dibuka — cegah javascript:/data:/file: dari konten LLM. */
export function isSafeExternalUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  // Tolak skema berbahaya secara sintaksis sebelum parsing
  if (/^\s*(javascript|data|vbscript|file|blob):/i.test(trimmed)) return false;
  try {
    const u = new URL(trimmed);
    return ALLOWED_PROTOCOLS.has(u.protocol);
  } catch {
    return false;
  }
}

/**
 * Safely opens an external URL using the system's default browser via Tauri shell plugin,
 * with a graceful browser window.open fallback. Menolak URL tidak aman.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;
  if (!isSafeExternalUrl(url)) {
    console.warn('Blocked unsafe external URL:', url);
    return;
  }
  try {
    await open(url);
  } catch (err) {
    console.warn('Tauri open failed, falling back to window.open:', err);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
}
