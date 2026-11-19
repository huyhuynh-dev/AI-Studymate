import { summariesApi } from '@/services/summaries.api';
import { extractApiErrorMessage } from '@/services/subjects.api';
import type { NoteMediaKind } from '@/types';

export const NOTE_MEDIA_URI_PREFIX = 'r2://';

const MB = 1024 * 1024;
const CACHE_TTL_FALLBACK_MS = 50 * 60 * 1000;
const BATCH_WINDOW_MS = 20;

export const NOTE_MEDIA_MAX_SIZE_BY_KIND: Record<NoteMediaKind, number> = {
  image: 10 * MB,
  audio: 25 * MB,
  video: 50 * MB,
  file: 25 * MB,
};

const NOTE_MEDIA_KIND_LABEL: Record<NoteMediaKind, string> = {
  image: 'Hình ảnh',
  audio: 'Âm thanh',
  video: 'Video',
  file: 'Tệp đính kèm',
};

const IMAGE_MIME_TYPES = new Set<string>([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

const AUDIO_MIME_TYPES = new Set<string>([
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/aac',
  'audio/flac',
]);

const VIDEO_MIME_TYPES = new Set<string>([
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
]);

const DOCUMENT_FILE_MIME_TYPES = new Set<string>([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'text/csv',
  'application/csv',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
]);

const FILE_MIME_TYPES = new Set<string>([
  ...DOCUMENT_FILE_MIME_TYPES,
  ...IMAGE_MIME_TYPES,
  ...AUDIO_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
]);

const ALLOWED_MIMES_BY_KIND: Record<NoteMediaKind, Set<string>> = {
  image: IMAGE_MIME_TYPES,
  audio: AUDIO_MIME_TYPES,
  video: VIDEO_MIME_TYPES,
  file: FILE_MIME_TYPES,
};

const BLOCKED_EXTENSIONS = new Set<string>([
  '.html',
  '.htm',
  '.js',
  '.mjs',
  '.cjs',
  '.svg',
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.msi',
  '.dll',
  '.ps1',
  '.vbs',
]);

const EXTENSION_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.zip': 'application/zip',
};

function getFileExtension(fileName: string): string {
  const trimmed = fileName.trim().toLowerCase();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return '';
  }
  return trimmed.slice(lastDot);
}

export function isNoteMediaUri(url: string): boolean {
  return typeof url === 'string' && url.trim().startsWith(NOTE_MEDIA_URI_PREFIX);
}

export function inferFileMimeType(file: File): string {
  const baseMime = (file.type || '').split(';')[0].trim().toLowerCase();
  if (baseMime && baseMime !== 'application/octet-stream') {
    return baseMime === 'image/jpg' ? 'image/jpeg' : baseMime;
  }
  const ext = getFileExtension(file.name);
  return (ext && EXTENSION_TO_MIME[ext]) || 'application/octet-stream';
}

export function inferNoteMediaKindFromMime(mimeType: string): NoteMediaKind {
  if (IMAGE_MIME_TYPES.has(mimeType)) return 'image';
  if (VIDEO_MIME_TYPES.has(mimeType)) return 'video';
  if (AUDIO_MIME_TYPES.has(mimeType)) return 'audio';
  return 'file';
}

export type EmbedUrlValidationResult =
  | { valid: true; normalizedUrl: string }
  | { valid: false; error: string };

/**
 * Kiểm tra tính hợp lệ của đường dẫn URL do người dùng nhập để nhúng vào BlockNote.
 */
export function validateEmbedUrl(rawInput: string): EmbedUrlValidationResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { valid: false, error: 'Vui lòng nhập đường dẫn URL.' };
  }

  if (/\s/.test(trimmed)) {
    return {
      valid: false,
      error: 'Đường dẫn URL không hợp lệ (không được chứa khoảng trắng).',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      error: 'URL không đúng định dạng (ví dụ: https://example.com/anh.png).',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: 'Chỉ hỗ trợ đường dẫn công khai bắt đầu bằng http:// hoặc https://.',
    };
  }

  const host = parsed.hostname;
  const isValidHost =
    host === 'localhost' ||
    (host.includes('.') && !host.startsWith('.') && !host.endsWith('.'));

  if (!isValidHost) {
    return {
      valid: false,
      error: 'Tên miền trong đường dẫn URL không hợp lệ.',
    };
  }

  return { valid: true, normalizedUrl: parsed.href };
}

/**
 * Kiểm tra URL đã lưu trong DB an toàn để nạp lại vào editor (chấp nhận r2:// hoặc http/https).
 */
export function isSafeStoredMediaUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;

  if (trimmed.startsWith(NOTE_MEDIA_URI_PREFIX)) {
    const key = trimmed.slice(NOTE_MEDIA_URI_PREFIX.length);
    return (
      key.length > 0 &&
      !key.startsWith('/') &&
      !key.includes('..') &&
      !key.includes('\\')
    );
  }

  return validateEmbedUrl(trimmed).valid;
}

export type UploadFileValidationResult =
  | { valid: true; mimeType: string; mediaKind: NoteMediaKind }
  | { valid: false; error: string };

export function validateUploadFile(
  file: File,
  expectedKind?: NoteMediaKind,
): UploadFileValidationResult {
  const ext = getFileExtension(file.name);
  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Định dạng tệp "${ext}" bị chặn vì lý do bảo mật.`,
    };
  }

  const mimeType = inferFileMimeType(file);
  const mediaKind = expectedKind ?? inferNoteMediaKindFromMime(mimeType);
  const allowedMimes = ALLOWED_MIMES_BY_KIND[mediaKind];

  if (!allowedMimes.has(mimeType)) {
    return {
      valid: false,
      error: `${NOTE_MEDIA_KIND_LABEL[mediaKind]} không hỗ trợ định dạng "${mimeType}".`,
    };
  }

  const maxBytes = NOTE_MEDIA_MAX_SIZE_BY_KIND[mediaKind];
  if (!Number.isFinite(file.size) || file.size < 1) {
    return {
      valid: false,
      error: 'Tệp tin rỗng hoặc không hợp lệ.',
    };
  }

  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / MB);
    return {
      valid: false,
      error: `${NOTE_MEDIA_KIND_LABEL[mediaKind]} vượt quá giới hạn ${maxMb} MB.`,
    };
  }

  return { valid: true, mimeType, mediaKind };
}

// Cache client-side cho các r2:// URI đã resolve sang Presigned GET URL
const resolvedMediaCache = new Map<string, { url: string; expiresAt: number }>();

export function primeNoteMediaCache(
  mediaUri: string,
  resolvedUrl: string,
  ttlMs = CACHE_TTL_FALLBACK_MS,
): void {
  if (!mediaUri || !resolvedUrl) return;
  resolvedMediaCache.set(mediaUri, {
    url: resolvedUrl,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Tải tệp lên Cloudflare R2 cho ghi chú hiện tại và trả về URI bền vững r2://...
 */
export async function uploadNoteMediaFile(
  summaryId: string,
  file: File,
  expectedKind?: NoteMediaKind,
): Promise<string> {
  const validation = validateUploadFile(file, expectedKind);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  try {
    const init = await summariesApi.initMediaUpload(summaryId, {
      fileName: file.name,
      fileSize: file.size,
      mimeType: validation.mimeType,
      mediaKind: validation.mediaKind,
    });

    await summariesApi.uploadMediaToR2(init.uploadUrl, file, init.mimeType);

    const completed = await summariesApi.completeMediaUpload(summaryId, {
      storageKey: init.storageKey,
      fileName: file.name,
      mediaKind: validation.mediaKind,
    });

    primeNoteMediaCache(completed.mediaUri, completed.resolvedUrl);
    return completed.mediaUri;
  } catch (err: unknown) {
    throw new Error(
      extractApiErrorMessage(err, 'Không thể tải tệp lên. Vui lòng thử lại.'),
    );
  }
}

interface PendingResolveEntry {
  resolve: (resolvedUrl: string) => void;
}

/**
 * Tạo hàm resolveFileUrl cho BlockNote có cache 50 phút và gom batch các URI phát sinh cùng lúc.
 */
export function createBatchedMediaUrlResolver(
  summaryId: string,
): (url: string) => Promise<string> {
  let pendingEntries = new Map<string, PendingResolveEntry[]>();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const flushBatch = async () => {
    flushTimer = null;
    const batch = pendingEntries;
    pendingEntries = new Map<string, PendingResolveEntry[]>();

    const uris = Array.from(batch.keys());
    if (uris.length === 0) return;

    try {
      const response = await summariesApi.resolveMediaUrls(summaryId, uris);
      const ttlMs = Math.min(
        CACHE_TTL_FALLBACK_MS,
        Math.max(60_000, (response.expiresIn - 300) * 1000),
      );

      for (const uri of uris) {
        const resolvedUrl = response.urls[uri] ?? '';
        if (resolvedUrl) {
          primeNoteMediaCache(uri, resolvedUrl, ttlMs);
        }
        const waiters = batch.get(uri) ?? [];
        for (const waiter of waiters) {
          waiter.resolve(resolvedUrl);
        }
      }
    } catch (err: unknown) {
      console.warn('[NoteMedia] Không thể giải mã danh sách media URI:', err);
      for (const waiters of batch.values()) {
        for (const waiter of waiters) {
          waiter.resolve('');
        }
      }
    }
  };

  return (rawUrl: string): Promise<string> => {
    const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!trimmed) return Promise.resolve('');

    if (!isNoteMediaUri(trimmed)) {
      return Promise.resolve(trimmed);
    }

    const cached = resolvedMediaCache.get(trimmed);
    if (cached && cached.expiresAt > Date.now()) {
      return Promise.resolve(cached.url);
    }

    return new Promise<string>((resolve) => {
      const existingWaiters = pendingEntries.get(trimmed);
      if (existingWaiters) {
        existingWaiters.push({ resolve });
      } else {
        pendingEntries.set(trimmed, [{ resolve }]);
      }

      if (!flushTimer) {
        flushTimer = setTimeout(() => {
          void flushBatch();
        }, BATCH_WINDOW_MS);
      }
    });
  };
}
