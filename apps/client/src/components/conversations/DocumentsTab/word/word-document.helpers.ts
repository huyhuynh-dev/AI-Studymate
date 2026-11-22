import type { DocumentItem } from '@/types/document';
import type { UserProfile } from '@/types/user';

export const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const LEGACY_DOC_MIME_TYPE = 'application/msword';
export const ODT_MIME_TYPE = 'application/vnd.oasis.opendocument.text';

const GOOGLE_DOCS_CLIENT_REGEX =
  /^\/document(?:\/u\/\d+)?\/d\/(?!e(?:\/|$))([a-zA-Z0-9_-]{15,128})(?:\/|$)/;
const PUBLISHED_WEB_PATH_REGEX = /^\/document(?:\/u\/\d+)?\/d\/e\//;

function getNormalizedExtension(fileName?: string | null): string {
  if (!fileName) return '';
  const dotIdx = fileName.lastIndexOf('.');
  return dotIdx >= 0 ? fileName.slice(dotIdx + 1).toLowerCase() : '';
}

function getNormalizedMime(mimeType?: string | null): string {
  return mimeType?.split(';')[0]?.trim().toLowerCase() ?? '';
}

export function isDocxDocument(
  doc: Pick<DocumentItem, 'mime_type' | 'file_name'> | null | undefined,
): boolean {
  if (!doc) return false;
  if (getNormalizedMime(doc.mime_type) === DOCX_MIME_TYPE) {
    return true;
  }
  return getNormalizedExtension(doc.file_name) === 'docx';
}

export function isLegacyWordOrOdtDocument(
  doc: Pick<DocumentItem, 'mime_type' | 'file_name'> | null | undefined,
): boolean {
  if (!doc) return false;
  const mime = getNormalizedMime(doc.mime_type);
  if (mime === LEGACY_DOC_MIME_TYPE || mime === ODT_MIME_TYPE) {
    return true;
  }
  const ext = getNormalizedExtension(doc.file_name);
  return ext === 'doc' || ext === 'odt';
}

export function isGoogleDocsImported(
  doc: Pick<DocumentItem, 'doc_metadata'> | null | undefined,
): boolean {
  const meta = doc?.doc_metadata;
  if (!meta || typeof meta !== 'object') return false;
  return (meta as Record<string, unknown>).source_type === 'google_docs';
}

export function getGoogleDocsSourceUrl(
  doc: Pick<DocumentItem, 'doc_metadata'> | null | undefined,
): string | null {
  const meta = doc?.doc_metadata;
  if (!meta || typeof meta !== 'object') return null;
  const rawUrl = (meta as Record<string, unknown>).source_url;
  return typeof rawUrl === 'string' && rawUrl.startsWith('https://')
    ? rawUrl
    : null;
}

export function validateGoogleDocsUrlClient(
  rawUrl: string,
): { valid: boolean; reason?: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, reason: 'Vui lòng dán liên kết Google Docs.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      reason:
        'Đường dẫn không hợp lệ. Ví dụ đúng: https://docs.google.com/document/d/.../edit',
    };
  }

  if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'docs.google.com') {
    return {
      valid: false,
      reason: 'Chỉ hỗ trợ liên kết HTTPS từ tên miền docs.google.com.',
    };
  }

  if (PUBLISHED_WEB_PATH_REGEX.test(parsed.pathname)) {
    return {
      valid: false,
      reason:
        'Liên kết "Xuất bản lên web" (/d/e/...) không xuất được DOCX. Hãy dùng liên kết chia sẻ (/document/d/<ID>/edit).',
    };
  }

  if (!GOOGLE_DOCS_CLIENT_REGEX.test(parsed.pathname)) {
    return {
      valid: false,
      reason: 'Không tìm thấy Document ID hợp lệ trong liên kết Google Docs.',
    };
  }

  return { valid: true };
}

export function buildSuperDocUser(
  user: Pick<UserProfile, 'id' | 'name' | 'email'> | null | undefined,
): { id: string; name: string; email: string } {
  const safeName = user?.name?.trim() || 'Học viên StudyMate';
  const safeEmail = user?.email?.trim() || 'student@studymate.local';
  const safeId = user?.id?.trim() || 'studymate-user';
  return {
    id: safeId,
    name: safeName,
    email: safeEmail,
  };
}

function cleanMarkdownForSearch(raw: string): string {
  return raw
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`~>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildCitationSearchQueries(target: {
  quoteExact?: string | null;
  rawContent?: string | null;
  headings?: string[] | null;
}): string[] {
  const candidates: string[] = [];

  const pushCleanedSource = (source?: string | null) => {
    if (!source) return;
    const cleaned = cleanMarkdownForSearch(source);
    if (cleaned.length < 4) return;

    // Ưu tiên đoạn câu đặc trưng 40-90 ký tự ở đầu trích dẫn
    if (cleaned.length > 90) {
      const cutAtSpace = cleaned.lastIndexOf(' ', 88);
      const longPhrase = cleaned.slice(0, cutAtSpace > 40 ? cutAtSpace : 88).trim();
      if (longPhrase.length >= 4) candidates.push(longPhrase);

      const midCut = cleaned.lastIndexOf(' ', 44);
      const shortPhrase = cleaned.slice(0, midCut > 24 ? midCut : 44).trim();
      if (shortPhrase.length >= 4) candidates.push(shortPhrase);
    } else {
      candidates.push(cleaned);
      if (cleaned.length > 48) {
        const cutAtSpace = cleaned.lastIndexOf(' ', 44);
        const shorter = cleaned.slice(0, cutAtSpace > 24 ? cutAtSpace : 44).trim();
        if (shorter.length >= 4) candidates.push(shorter);
      }
    }
  };

  pushCleanedSource(target.quoteExact);
  pushCleanedSource(target.rawContent);

  if (Array.isArray(target.headings)) {
    for (let i = target.headings.length - 1; i >= 0; i -= 1) {
      const h = cleanMarkdownForSearch(target.headings[i] ?? '');
      if (h.length >= 4) {
        candidates.push(h);
        break;
      }
    }
  }

  return Array.from(new Set(candidates));
}

export function stripExtensionForExport(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) return 'tai-lieu';
  const stripped = trimmed.replace(/\.(docx|doc|odt)$/i, '').trim();
  return stripped || 'tai-lieu';
}
