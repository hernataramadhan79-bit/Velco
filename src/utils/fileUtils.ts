export type FileCategory = 'all' | 'image' | 'document' | 'media' | 'archive' | 'code' | 'other';

export interface FileTypeMeta {
  category: FileCategory;
  extension: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  iconBg: string;
  iconColor: string;
}

export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const formatted = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${formatted} ${units[i]}`;
}

export function getFileExtension(filename: string): string {
  if (!filename) return '';
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0 || lastDot === filename.length - 1) return '';
  return filename.slice(lastDot + 1).toLowerCase();
}

export function getFileCategory(filename: string, mimeType?: string): FileCategory {
  const ext = getFileExtension(filename);
  const mime = (mimeType || '').toLowerCase();

  if (
    mime.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico', 'avif'].includes(ext)
  ) {
    return 'image';
  }

  if (
    mime.startsWith('audio/') ||
    mime.startsWith('video/') ||
    ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'mp4', 'mov', 'webm', 'mkv'].includes(ext)
  ) {
    return 'media';
  }

  if (
    ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx', 'csv'].includes(ext) ||
    mime.includes('pdf') ||
    mime.includes('document') ||
    mime.includes('spreadsheet')
  ) {
    return 'document';
  }

  if (
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext) ||
    mime.includes('zip') ||
    mime.includes('compressed') ||
    mime.includes('archive')
  ) {
    return 'archive';
  }

  if (
    ['ts', 'tsx', 'js', 'jsx', 'rs', 'py', 'json', 'html', 'css', 'sql', 'toml', 'yaml', 'yml', 'md', 'sh'].includes(ext)
  ) {
    return 'code';
  }

  return 'other';
}

export function getFileTypeMeta(filename: string, mimeType?: string): FileTypeMeta {
  const category = getFileCategory(filename, mimeType);
  const rawExt = getFileExtension(filename);
  const extension = rawExt ? rawExt.toUpperCase() : 'FILE';

  switch (category) {
    case 'image':
      return {
        category,
        extension,
        badgeBg: 'bg-sky-50 dark:bg-sky-950/40',
        badgeText: 'text-sky-700 dark:text-sky-300',
        badgeBorder: 'border-sky-200 dark:border-sky-800/60',
        iconBg: 'bg-sky-100 dark:bg-sky-900/30',
        iconColor: 'text-sky-600 dark:text-sky-400',
      };
    case 'document':
      if (rawExt === 'pdf') {
        return {
          category,
          extension,
          badgeBg: 'bg-rose-50 dark:bg-rose-950/40',
          badgeText: 'text-rose-700 dark:text-rose-300',
          badgeBorder: 'border-rose-200 dark:border-rose-800/60',
          iconBg: 'bg-rose-100 dark:bg-rose-900/30',
          iconColor: 'text-rose-600 dark:text-rose-400',
        };
      }
      return {
        category,
        extension,
        badgeBg: 'bg-blue-50 dark:bg-blue-950/40',
        badgeText: 'text-blue-700 dark:text-blue-300',
        badgeBorder: 'border-blue-200 dark:border-blue-800/60',
        iconBg: 'bg-blue-100 dark:bg-blue-900/30',
        iconColor: 'text-blue-600 dark:text-blue-400',
      };
    case 'media':
      return {
        category,
        extension,
        badgeBg: 'bg-purple-50 dark:bg-purple-950/40',
        badgeText: 'text-purple-700 dark:text-purple-300',
        badgeBorder: 'border-purple-200 dark:border-purple-800/60',
        iconBg: 'bg-purple-100 dark:bg-purple-900/30',
        iconColor: 'text-purple-600 dark:text-purple-400',
      };
    case 'archive':
      return {
        category,
        extension,
        badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
        badgeText: 'text-amber-700 dark:text-amber-300',
        badgeBorder: 'border-amber-200 dark:border-amber-800/60',
        iconBg: 'bg-amber-100 dark:bg-amber-900/30',
        iconColor: 'text-amber-600 dark:text-amber-400',
      };
    case 'code':
      return {
        category,
        extension,
        badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
        badgeText: 'text-emerald-700 dark:text-emerald-300',
        badgeBorder: 'border-emerald-200 dark:border-emerald-800/60',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
      };
    default:
      return {
        category,
        extension,
        badgeBg: 'bg-slate-100 dark:bg-zinc-800/70',
        badgeText: 'text-slate-700 dark:text-zinc-300',
        badgeBorder: 'border-slate-200 dark:border-zinc-700',
        iconBg: 'bg-slate-100 dark:bg-zinc-800',
        iconColor: 'text-slate-500 dark:text-zinc-400',
      };
  }
}

/**
 * Parses size string like "Size: 12.4 KB" from item content if available
 */
export function extractSizeFromContent(content?: string): string | null {
  if (!content) return null;
  const match = content.match(/Size:\s*([0-9.]+\s*[KMGT]?B)/i);
  return match ? match[1] : null;
}

/**
 * Infers accurate MIME type from filename extension if native file.type is missing or generic.
 */
export function inferMimeType(filename: string, existingMime?: string): string {
  if (
    existingMime &&
    existingMime.trim() !== '' &&
    existingMime !== 'application/octet-stream' &&
    existingMime !== 'binary/octet-stream'
  ) {
    return existingMime;
  }

  const ext = getFileExtension(filename);
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'svg': return 'image/svg+xml';
    case 'bmp': return 'image/bmp';
    case 'ico': return 'image/x-icon';
    case 'avif': return 'image/avif';
    case 'pdf': return 'application/pdf';
    case 'txt':
    case 'log': return 'text/plain';
    case 'md':
    case 'markdown': return 'text/markdown';
    case 'json': return 'application/json';
    case 'csv': return 'text/csv';
    case 'html': return 'text/html';
    case 'css': return 'text/css';
    case 'js':
    case 'jsx': return 'text/javascript';
    case 'ts':
    case 'tsx': return 'text/typescript';
    case 'zip': return 'application/zip';
    case 'doc':
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xls':
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'ppt':
    case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'mp3': return 'audio/mpeg';
    case 'wav': return 'audio/wav';
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    default: return existingMime || 'application/octet-stream';
  }
}

/**
 * Checks whether a file is an image by MIME type or extension.
 */
export function isImageFile(filename: string, mimeType?: string): boolean {
  const mime = (mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  const ext = getFileExtension(filename);
  return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico', 'avif'].includes(ext);
}

/**
 * Creates a lightweight image thumbnail (Base64 JPEG/PNG) using FileReader and an offscreen canvas.
 * - Uses FileReader.readAsDataURL directly (never fails with CORS or blob restrictions in WebView2).
 * - Offscreen canvas resizes large images to ~20-40 KB for snappy previewing and minimal SQLite payload.
 * - Guaranteed fail-safe: always falls back to raw dataUrl if canvas, image decode or timeout occurs.
 */
export async function createImageThumbnail(
  file: File,
  maxDimension = 480,
  quality = 0.82
): Promise<string> {
  // Step 1: Read the file using FileReader (100% reliable in WebView2)
  const rawDataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });

  if (!rawDataUrl) {
    return '';
  }

  const ext = getFileExtension(file.name);
  const isSvg = file.type.includes('svg') || ext === 'svg';
  const isGif = file.type.includes('gif') || ext === 'gif';

  // Return raw data URL immediately for SVGs, GIFs (preserve animation), or small files
  if (isSvg || isGif || file.size < 80 * 1024) {
    return rawDataUrl;
  }

  // Step 2: Attempt offscreen canvas resize for smaller SQLite footprint
  try {
    const resizedDataUrl = await new Promise<string>((resolve) => {
      const img = new Image();

      // Guard with timeout so decoding issues never hang the promise
      const timer = setTimeout(() => {
        resolve(rawDataUrl);
      }, 2500);

      img.onload = () => {
        clearTimeout(timer);
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          if (!width || !height) {
            return resolve(rawDataUrl);
          }

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(rawDataUrl);
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          const targetMime = (file.type.includes('png') || ext === 'png') ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(targetMime, quality);

          if (dataUrl && dataUrl.length > 50) {
            resolve(dataUrl);
          } else {
            resolve(rawDataUrl);
          }
        } catch {
          resolve(rawDataUrl);
        }
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve(rawDataUrl);
      };

      // Crucial: assign base64 rawDataUrl directly (no blob URL)
      img.src = rawDataUrl;
    });

    return resizedDataUrl;
  } catch {
    return rawDataUrl;
  }
}

