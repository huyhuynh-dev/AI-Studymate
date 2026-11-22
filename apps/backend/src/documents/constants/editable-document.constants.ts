export const MAX_EDITABLE_TEXT_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_READONLY_PREVIEW_BYTES = 200 * 1024; // 200 KB

export const EDITABLE_TEXT_EXTENSION_TO_MIME: Record<string, string> = {
  md: 'text/markdown',
  markdown: 'text/markdown',
  html: 'text/html',
  htm: 'text/html',
  txt: 'text/plain',
  log: 'text/plain',
  json: 'application/json',
  xml: 'application/xml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  csv: 'text/csv',
  toml: 'application/toml',
};

export const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const LEGACY_DOC_MIME_TYPE = 'application/msword';
export const ODT_MIME_TYPE = 'application/vnd.oasis.opendocument.text';

export const BINARY_DOCUMENT_EXTENSION_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: LEGACY_DOC_MIME_TYPE,
  docx: DOCX_MIME_TYPE,
  odt: ODT_MIME_TYPE,
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function normalizeDocFileExtension(fileName?: string | null): string {
  if (!fileName) return '';
  const dotIdx = fileName.lastIndexOf('.');
  return dotIdx >= 0 ? fileName.slice(dotIdx + 1).toLowerCase() : '';
}

export function isDocxDocument(mimeType?: string | null, fileName?: string | null): boolean {
  const normalizedMime = mimeType?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (normalizedMime === DOCX_MIME_TYPE) {
    return true;
  }
  return normalizeDocFileExtension(fileName) === 'docx';
}

export function isLegacyWordOrOdtDocument(
  mimeType?: string | null,
  fileName?: string | null,
): boolean {
  const normalizedMime = mimeType?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (normalizedMime === LEGACY_DOC_MIME_TYPE || normalizedMime === ODT_MIME_TYPE) {
    return true;
  }
  const ext = normalizeDocFileExtension(fileName);
  return ext === 'doc' || ext === 'odt';
}

export const ALL_ALLOWED_EXTENSION_TO_MIME: Record<string, string> = {
  ...BINARY_DOCUMENT_EXTENSION_TO_MIME,
  ...EDITABLE_TEXT_EXTENSION_TO_MIME,
};

const EDITABLE_TEXT_MIME_SET = new Set<string>([
  'text/markdown',
  'text/x-markdown',
  'text/html',
  'text/plain',
  'application/json',
  'text/json',
  'application/xml',
  'text/xml',
  'application/yaml',
  'application/x-yaml',
  'text/yaml',
  'text/x-yaml',
  'text/csv',
  'application/csv',
  'application/toml',
  'text/toml',
  'text/x-toml',
]);

const MIME_CANONICAL_MAP: Record<string, string> = {
  'text/x-markdown': 'text/markdown',
  'application/csv': 'text/csv',
  'text/json': 'application/json',
  'text/xml': 'application/xml',
  'application/x-yaml': 'application/yaml',
  'text/yaml': 'application/yaml',
  'text/x-yaml': 'text/yaml',
  'text/toml': 'application/toml',
  'text/x-toml': 'application/toml',
  'image/jpg': 'image/jpeg',
};

const ALLOWED_CANONICAL_MIME_SET = new Set<string>(
  Object.values(ALL_ALLOWED_EXTENSION_TO_MIME),
);

const STRUCTURED_FENCE_LANGUAGE_BY_EXT: Record<string, string> = {
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  csv: 'csv',
};

export function getFileExtension(fileName: string): string {
  const trimmed = fileName.trim();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return '';
  }
  return trimmed.slice(lastDot + 1).toLowerCase();
}

export function normalizeMimeType(rawMimeType?: string | null): string {
  const lower = (rawMimeType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  return MIME_CANONICAL_MAP[lower] ?? lower;
}

/**
 * Chuẩn hóa MIME type hợp lệ cho cả trình duyệt gửi thiếu MIME / application/octet-stream / text/plain cho file .md/.yaml/.toml.
 * Trả về `null` nếu định dạng không nằm trong danh sách cho phép.
 */
export function resolveCanonicalMimeType(
  fileName: string,
  rawMimeType?: string | null,
): string | null {
  const ext = getFileExtension(fileName);
  const extMime = ext ? ALL_ALLOWED_EXTENSION_TO_MIME[ext] : undefined;
  const normalizedRaw = normalizeMimeType(rawMimeType);

  if (ext) {
    if (!extMime) {
      return null;
    }

    if (
      !normalizedRaw ||
      normalizedRaw === 'application/octet-stream' ||
      (normalizedRaw === 'text/plain' && ext !== 'txt' && ext !== 'log')
    ) {
      return extMime;
    }

    if (ALLOWED_CANONICAL_MIME_SET.has(normalizedRaw)) {
      return extMime;
    }

    return null;
  }

  if (normalizedRaw && ALLOWED_CANONICAL_MIME_SET.has(normalizedRaw)) {
    return normalizedRaw;
  }

  return null;
}

export function isEditableTextDocument(mimeType: string, fileName: string): boolean {
  const ext = getFileExtension(fileName);
  if (ext && EDITABLE_TEXT_EXTENSION_TO_MIME[ext]) {
    return true;
  }
  const normalized = normalizeMimeType(mimeType);
  return EDITABLE_TEXT_MIME_SET.has(normalized);
}

/**
 * Toàn bộ định dạng văn bản thuần / markup chỉnh sửa được đều đi qua nhánh đọc UTF-8 trực tiếp
 * rồi băm qua Docling HybridChunker (tránh gửi HTML/JSON qua bước OCR Convert nặng nề).
 */
export function isDirectTextIngestionDocument(
  mimeType: string,
  fileName: string,
): boolean {
  return isEditableTextDocument(mimeType, fileName);
}

function decodeCommonHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

/**
 * Rút trích văn bản Markdown sạch từ HTML, loại bỏ script/style/noscript để nạp vào Docling HybridChunker.
 */
export function convertHtmlToPlainMarkdown(html: string): string {
  let text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '\n')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '\n')
    .replace(/<!--[\s\S]*?-->/g, '');

  for (let level = 1; level <= 6; level += 1) {
    const headingRegex = new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi');
    const prefix = '#'.repeat(level);
    text = text.replace(headingRegex, (_match, inner: string) => `\n${prefix} ${inner}\n`);
  }

  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/(p|div|section|article|header|footer|blockquote|tr|pre|table|ul|ol)>/gi, '\n')
    .replace(/<td\b[^>]*>|<th\b[^>]*>/gi, ' | ')
    .replace(/<[^>]+>/g, '');

  return decodeCommonHtmlEntities(text)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface PreparedTextForChunking {
  chunkInputMarkdown: string;
  extractedRawText: string;
  isHtml: boolean;
}

export function prepareTextForHybridChunking(
  rawUtf8: string,
  mimeType: string,
  fileName: string,
): PreparedTextForChunking {
  const normalized = rawUtf8.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) {
    return {
      chunkInputMarkdown: '',
      extractedRawText: '',
      isHtml: false,
    };
  }

  const ext = getFileExtension(fileName);
  const mime = normalizeMimeType(mimeType);

  if (ext === 'html' || ext === 'htm' || mime === 'text/html') {
    const markdownText = convertHtmlToPlainMarkdown(normalized);
    return {
      chunkInputMarkdown: markdownText,
      extractedRawText: markdownText,
      isHtml: true,
    };
  }

  if (ext === 'json' || mime === 'application/json') {
    let formattedJson = normalized;
    try {
      const parsed: unknown = JSON.parse(normalized);
      const lineCount = normalized.split('\n').length;
      if (lineCount <= 2 || normalized.length / lineCount > 140) {
        formattedJson = JSON.stringify(parsed, null, 2);
      }
    } catch {
      // Giữ nguyên chuỗi JSON hiện tại nếu chưa hợp lệ hoặc đang ở trạng thái bán thành phẩm
    }

    return {
      chunkInputMarkdown: `# ${fileName}\n\n\`\`\`json\n${formattedJson}\n\`\`\``,
      extractedRawText: normalized,
      isHtml: false,
    };
  }

  const fenceLang =
    STRUCTURED_FENCE_LANGUAGE_BY_EXT[ext] ??
    (mime === 'application/xml'
      ? 'xml'
      : mime === 'application/yaml'
        ? 'yaml'
        : mime === 'application/toml'
          ? 'toml'
          : mime === 'text/csv'
            ? 'csv'
            : null);

  if (fenceLang) {
    return {
      chunkInputMarkdown: `# ${fileName}\n\n\`\`\`${fenceLang}\n${normalized}\n\`\`\``,
      extractedRawText: normalized,
      isHtml: false,
    };
  }

  return {
    chunkInputMarkdown: normalized,
    extractedRawText: normalized,
    isHtml: false,
  };
}

export function sliceUtf8Preview(buffer: Buffer, maxBytes = MAX_READONLY_PREVIEW_BYTES): string {
  if (buffer.length <= maxBytes) {
    return buffer.toString('utf-8');
  }
  // Cắt an toàn ở ranh giới UTF-8 rồi bỏ ký tự thay thế (U+FFFD) ở cuối nếu cắt giữa codepoint
  return buffer.subarray(0, maxBytes).toString('utf-8').replace(/\uFFFD+$/g, '');
}
