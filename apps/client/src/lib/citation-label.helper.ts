import type { TextCitationAnchor } from '@/types/source-ref';

const NON_PAGED_TEXT_EXTENSIONS = new Set([
  'md',
  'markdown',
  'html',
  'htm',
  'txt',
  'log',
  'json',
  'xml',
  'yaml',
  'yml',
  'csv',
  'toml',
]);

const PAGED_BINARY_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'jpg',
  'jpeg',
  'png',
  'webp',
]);

const MARKDOWN_OR_HTML_EXTENSIONS = new Set(['md', 'markdown', 'html', 'htm']);

const WORD_OR_ODT_EXTENSIONS = new Set(['doc', 'docx', 'odt']);

const WORD_OR_ODT_MIME_SET = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
]);

const NON_PAGED_MIME_SET = new Set([
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

export interface CitationLabelInput {
  fileName?: string | null;
  mimeType?: string | null;
  pageNumbers?: number[] | null;
  pageNo?: number | null;
  textAnchor?: TextCitationAnchor | null;
  headings?: string[] | null;
  chunkIndex?: number | null;
  variant?: 'compact' | 'detailed';
}

function getFileExtension(fileName?: string | null): string {
  if (!fileName) return '';
  const trimmed = fileName.trim();
  const dotIdx = trimmed.lastIndexOf('.');
  if (dotIdx <= 0 || dotIdx === trimmed.length - 1) return '';
  return trimmed.slice(dotIdx + 1).toLowerCase();
}

function normalizeMime(mimeType?: string | null): string {
  return (mimeType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}

/**
 * Xác định tệp có thuộc nhóm phân trang (PDF / Office / Ảnh) hay văn bản liên tục (Plain Text / Markdown / Markup).
 */
export function isPagedDocumentFile(
  fileName?: string | null,
  mimeType?: string | null,
): boolean {
  const ext = getFileExtension(fileName);
  if (ext && NON_PAGED_TEXT_EXTENSIONS.has(ext)) {
    return false;
  }
  if (ext && PAGED_BINARY_EXTENSIONS.has(ext)) {
    return true;
  }

  const mime = normalizeMime(mimeType);
  if (mime) {
    if (NON_PAGED_MIME_SET.has(mime) || mime.startsWith('text/')) {
      return false;
    }
    if (
      mime === 'application/pdf' ||
      mime.startsWith('image/') ||
      mime.includes('wordprocessingml') ||
      mime.includes('spreadsheetml') ||
      mime.includes('presentationml') ||
      mime === 'application/msword' ||
      mime === 'application/vnd.ms-excel' ||
      mime === 'application/vnd.ms-powerpoint'
    ) {
      return true;
    }
  }

  return true;
}

export function isWordDocumentFile(
  fileName?: string | null,
  mimeType?: string | null,
): boolean {
  const ext = getFileExtension(fileName);
  if (ext && WORD_OR_ODT_EXTENSIONS.has(ext)) return true;
  const mime = normalizeMime(mimeType);
  return (
    WORD_OR_ODT_MIME_SET.has(mime) || mime.includes('wordprocessingml')
  );
}

function hasReliablePhysicalWordPage(input: CitationLabelInput): boolean {
  if (
    Array.isArray(input.pageNumbers) &&
    input.pageNumbers.some((p) => typeof p === 'number' && Number.isFinite(p) && p > 1)
  ) {
    return true;
  }
  return typeof input.pageNo === 'number' && Number.isFinite(input.pageNo) && input.pageNo > 1;
}

export function isCsvDocumentFile(
  fileName?: string | null,
  mimeType?: string | null,
): boolean {
  const ext = getFileExtension(fileName);
  if (ext === 'csv') return true;
  const mime = normalizeMime(mimeType);
  return mime === 'text/csv' || mime === 'application/csv';
}

function isMarkdownOrHtmlFile(
  fileName?: string | null,
  mimeType?: string | null,
): boolean {
  const ext = getFileExtension(fileName);
  if (ext && MARKDOWN_OR_HTML_EXTENSIONS.has(ext)) return true;
  const mime = normalizeMime(mimeType);
  return (
    mime === 'text/markdown' ||
    mime === 'text/x-markdown' ||
    mime === 'text/html'
  );
}

function resolveLastHeading(input: CitationLabelInput): string | null {
  const fromHeadings = input.headings?.filter((h) => h.trim().length > 0) ?? [];
  if (fromHeadings.length > 0) {
    return fromHeadings[fromHeadings.length - 1].trim();
  }
  const fromAnchor =
    input.textAnchor?.headingPath?.filter((h) => h.trim().length > 0) ?? [];
  if (fromAnchor.length > 0) {
    return fromAnchor[fromAnchor.length - 1].trim();
  }
  return null;
}

function formatRangeNumberLabel(start: number, end: number, unit: string): string {
  return start === end ? `${unit} ${start}` : `${unit} ${start}–${end}`;
}

function resolvePagedRangeLabel(input: CitationLabelInput): string {
  const validPages = Array.isArray(input.pageNumbers)
    ? input.pageNumbers.filter(
        (p) => typeof p === 'number' && Number.isFinite(p) && p > 0,
      )
    : [];

  if (validPages.length === 0) {
    const fallback =
      typeof input.pageNo === 'number' && Number.isFinite(input.pageNo) && input.pageNo > 0
        ? Math.floor(input.pageNo)
        : 1;
    return `Trang ${fallback}`;
  }

  const first = validPages[0];
  const last = validPages[validPages.length - 1];
  return formatRangeNumberLabel(first, last, 'Trang');
}

/**
 * Định dạng nhãn vị trí đa hình thay thế cho "Trang 1" cứng nhắc:
 * - Word / ODT (.docx, .doc, .odt): "§ Tên Heading" hoặc "Đoạn #N" khi phân trang động (hoặc "Trang X–Y" nếu có trang > 1)
 * - Tệp phân trang: "Trang X" / "Trang X–Y"
 * - Markdown/HTML: "Dòng X–Y" (compact) hoặc "Dòng X–Y · Tên Heading" (detailed); fallback legacy: "§ Tên Heading" hoặc "Đoạn #N"
 * - Plain Text/Log/JSON/XML/YAML/TOML: "Dòng X–Y"
 * - CSV: "Hàng X–Y"
 */
export function formatCitationLocationLabel(input: CitationLabelInput): string {
  const variant = input.variant ?? 'compact';
  const lastHeading = resolveLastHeading(input);
  const hasChunkIndex =
    typeof input.chunkIndex === 'number' &&
    Number.isFinite(input.chunkIndex) &&
    input.chunkIndex >= 0;

  if (isWordDocumentFile(input.fileName, input.mimeType)) {
    if (hasReliablePhysicalWordPage(input)) {
      const pageLabel = resolvePagedRangeLabel(input);
      return variant === 'detailed' && lastHeading
        ? `${pageLabel} · ${lastHeading}`
        : pageLabel;
    }
    if (lastHeading) {
      return `§ ${lastHeading}`;
    }
    if (hasChunkIndex) {
      return `Đoạn #${Math.floor(input.chunkIndex!) + 1}`;
    }
    return 'Tài liệu Word';
  }

  if (isPagedDocumentFile(input.fileName, input.mimeType)) {
    return resolvePagedRangeLabel(input);
  }

  const anchor = input.textAnchor ?? null;

  if (anchor) {
    const unit = isCsvDocumentFile(input.fileName, input.mimeType)
      ? 'Hàng'
      : 'Dòng';
    const lineLabel = formatRangeNumberLabel(anchor.startLine, anchor.endLine, unit);

    if (
      variant === 'detailed' &&
      isMarkdownOrHtmlFile(input.fileName, input.mimeType) &&
      lastHeading
    ) {
      return `${lineLabel} · ${lastHeading}`;
    }

    return lineLabel;
  }

  // Fallback tương thích cho bản ghi văn bản cũ chưa có textAnchor (tuyệt đối không hiện "Trang 1")
  if (variant === 'compact') {
    if (hasChunkIndex) {
      return `Đoạn #${Math.floor(input.chunkIndex!) + 1}`;
    }
    if (lastHeading) {
      return `§ ${lastHeading}`;
    }
    return isCsvDocumentFile(input.fileName, input.mimeType) ? 'Bảng CSV' : 'Văn bản';
  }

  if (lastHeading) {
    return `§ ${lastHeading}`;
  }
  if (hasChunkIndex) {
    return `Đoạn #${Math.floor(input.chunkIndex!) + 1}`;
  }
  return isCsvDocumentFile(input.fileName, input.mimeType) ? 'Bảng CSV' : 'Văn bản';
}

/**
 * Định dạng nhãn nút hành động nhảy tới vị trí trích dẫn ("Nhảy tới Trang X" / "Nhảy tới Dòng X–Y" / "Định vị đoạn trích").
 */
export function formatCitationActionLabel(input: CitationLabelInput): string {
  if (isWordDocumentFile(input.fileName, input.mimeType)) {
    return hasReliablePhysicalWordPage(input)
      ? `Nhảy tới ${resolvePagedRangeLabel(input)}`
      : 'Định vị đoạn trích';
  }

  if (isPagedDocumentFile(input.fileName, input.mimeType)) {
    return `Nhảy tới ${resolvePagedRangeLabel(input)}`;
  }

  if (input.textAnchor) {
    const unit = isCsvDocumentFile(input.fileName, input.mimeType)
      ? 'Hàng'
      : 'Dòng';
    return `Nhảy tới ${formatRangeNumberLabel(
      input.textAnchor.startLine,
      input.textAnchor.endLine,
      unit,
    )}`;
  }

  return 'Định vị đoạn trích';
}

/**
 * Định dạng tooltip giải thích nguồn trích dẫn cho nút nguồn (Flashcard / Quiz).
 */
export function formatCitationTooltipLabel(input: CitationLabelInput): string {
  const detail = formatCitationLocationLabel({ ...input, variant: 'detailed' });
  const prefix = isWordDocumentFile(input.fileName, input.mimeType)
    ? 'Xem nguồn trong tài liệu Word'
    : isPagedDocumentFile(input.fileName, input.mimeType)
      ? 'Xem nguồn trong PDF'
      : 'Xem nguồn trong tài liệu';
  return `${prefix} (${detail})`;
}
