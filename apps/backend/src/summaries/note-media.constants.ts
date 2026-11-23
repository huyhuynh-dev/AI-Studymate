export const NOTE_MEDIA_URI_PREFIX = 'r2://';

export const NOTE_MEDIA_KINDS = ['image', 'video', 'audio', 'file'] as const;
export type NoteMediaKind = (typeof NOTE_MEDIA_KINDS)[number];

const MB = 1024 * 1024;

export const NOTE_MEDIA_MAX_UPLOAD_BYTES = 50 * MB;

export const NOTE_MEDIA_MAX_SIZE_BY_KIND: Record<NoteMediaKind, number> = {
    image: 10 * MB,
    audio: 25 * MB,
    video: 50 * MB,
    file: 25 * MB,
};

export const NOTE_MEDIA_KIND_LABEL: Record<NoteMediaKind, string> = {
    image: 'Hình ảnh',
    audio: 'Âm thanh',
    video: 'Video',
    file: 'Tệp đính kèm',
};

export const IMAGE_MIME_TYPES = new Set<string>([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
]);

export const AUDIO_MIME_TYPES = new Set<string>([
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

export const VIDEO_MIME_TYPES = new Set<string>([
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
]);

export const DOCUMENT_FILE_MIME_TYPES = new Set<string>([
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

export const FILE_MIME_TYPES = new Set<string>([
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

export const BLOCKED_NOTE_MEDIA_EXTENSIONS = new Set<string>([
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

export function getFileExtension(fileName: string): string {
    const trimmed = fileName.trim().toLowerCase();
    const lastDot = trimmed.lastIndexOf('.');
    if (lastDot <= 0 || lastDot === trimmed.length - 1) {
        return '';
    }
    return trimmed.slice(lastDot);
}

export function normalizeNoteMediaMime(rawMime: string, fileName: string): string {
    const baseMime = (rawMime || '').split(';')[0].trim().toLowerCase();
    if (!baseMime || baseMime === 'application/octet-stream') {
        const ext = getFileExtension(fileName);
        if (ext && EXTENSION_TO_MIME[ext]) {
            return EXTENSION_TO_MIME[ext];
        }
    }
    if (baseMime === 'image/jpg') {
        return 'image/jpeg';
    }
    return baseMime;
}

export function inferNoteMediaKind(mimeType: string): NoteMediaKind {
    if (IMAGE_MIME_TYPES.has(mimeType)) return 'image';
    if (VIDEO_MIME_TYPES.has(mimeType)) return 'video';
    if (AUDIO_MIME_TYPES.has(mimeType)) return 'audio';
    return 'file';
}

export type NoteMediaValidationResult =
    | {
          ok: true;
          mimeType: string;
          mediaKind: NoteMediaKind;
          maxBytes: number;
      }
    | {
          ok: false;
          message: string;
      };

export function validateNoteMediaFile(params: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    requestedKind?: NoteMediaKind;
}): NoteMediaValidationResult {
    const ext = getFileExtension(params.fileName);
    if (ext && BLOCKED_NOTE_MEDIA_EXTENSIONS.has(ext)) {
        return {
            ok: false,
            message: `Định dạng tệp "${ext}" bị chặn vì lý do bảo mật.`,
        };
    }

    const normalizedMime = normalizeNoteMediaMime(params.mimeType, params.fileName);
    if (!normalizedMime) {
        return {
            ok: false,
            message: 'Không xác định được định dạng tệp hợp lệ.',
        };
    }

    const mediaKind = params.requestedKind ?? inferNoteMediaKind(normalizedMime);
    const allowedSet = ALLOWED_MIMES_BY_KIND[mediaKind];

    if (!allowedSet.has(normalizedMime)) {
        return {
            ok: false,
            message: `${NOTE_MEDIA_KIND_LABEL[mediaKind]} không hỗ trợ định dạng "${normalizedMime}".`,
        };
    }

    const maxBytes = NOTE_MEDIA_MAX_SIZE_BY_KIND[mediaKind];
    if (!Number.isFinite(params.fileSize) || params.fileSize < 1 || params.fileSize > maxBytes) {
        const maxMb = Math.round(maxBytes / MB);
        return {
            ok: false,
            message: `${NOTE_MEDIA_KIND_LABEL[mediaKind]} vượt quá giới hạn dung lượng tối đa ${maxMb} MB.`,
        };
    }

    return {
        ok: true,
        mimeType: normalizedMime,
        mediaKind,
        maxBytes,
    };
}

export function toNoteMediaUri(storageKey: string): string {
    return `${NOTE_MEDIA_URI_PREFIX}${storageKey}`;
}

export function extractStorageKeyFromMediaUri(uri: string): string | null {
    if (typeof uri !== 'string') return null;
    const trimmed = uri.trim();
    if (!trimmed.startsWith(NOTE_MEDIA_URI_PREFIX)) {
        return null;
    }

    const storageKey = trimmed.slice(NOTE_MEDIA_URI_PREFIX.length);
    if (
        !storageKey ||
        storageKey.startsWith('/') ||
        storageKey.includes('..') ||
        storageKey.includes('\\')
    ) {
        return null;
    }

    return storageKey;
}

export function buildNoteMediaPrefix(
    userId: string,
    conversationId: string,
    summaryId: string,
): string {
    return `users/${userId}/conversations/${conversationId}/summaries/${summaryId}/media/`;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isOwnedNoteMediaKey(storageKey: string, userId: string): boolean {
    if (
        !storageKey ||
        !userId ||
        storageKey.includes('..') ||
        storageKey.includes('\\')
    ) {
        return false;
    }

    const pattern = new RegExp(
        `^users/${escapeRegExp(userId)}/conversations/[0-9a-fA-F-]+/summaries/[0-9a-fA-F-]+/media/[^/]+$`,
    );
    return pattern.test(storageKey);
}

export function collectNoteMediaKeysFromBlocks(
    blocks: unknown,
    requiredPrefix?: string,
): string[] {
    if (!Array.isArray(blocks)) return [];

    const keys = new Set<string>();

    const walk = (items: unknown[]) => {
        for (const item of items) {
            if (!item || typeof item !== 'object') continue;
            const record = item as Record<string, unknown>;

            const props = record.props;
            if (props && typeof props === 'object') {
                const rawUrl = (props as Record<string, unknown>).url;
                if (typeof rawUrl === 'string') {
                    const key = extractStorageKeyFromMediaUri(rawUrl);
                    if (key && (!requiredPrefix || key.startsWith(requiredPrefix))) {
                        keys.add(key);
                    }
                }
            }

            if (Array.isArray(record.children)) {
                walk(record.children);
            }
        }
    };

    walk(blocks);
    return Array.from(keys);
}
