/**
 * Neo trích dẫn chuẩn W3C-style cho tệp văn bản thuần, Markdown và dữ liệu có cấu trúc.
 */
export interface TextCitationAnchor {
  startLine: number;
  endLine: number;
  charStart: number;
  charEnd: number;
  quoteExact: string;
  quotePrefix?: string;
  quoteSuffix?: string;
  headingPath?: string[];
}

/**
 * Hợp đồng dữ liệu liên kết nguồn gốc (Evidence Grounding) phía Client,
 * ánh xạ từ trường `source_refs` / `sourceRefs` của Backend API.
 */
export interface SourceReference {
  documentId: string;
  fileName: string;
  chunkId?: string;
  chunkIndex?: number;
  pageNumbers: number[];
  bboxes?: unknown[];
  headings?: string[];
  snippet?: string;
  textAnchor?: TextCitationAnchor;
}

function readPositiveInt(val: unknown): number | null {
  if (typeof val !== 'number' || !Number.isFinite(val)) return null;
  const floored = Math.floor(val);
  return floored >= 1 ? floored : null;
}

function readNonNegativeInt(val: unknown): number | null {
  if (typeof val !== 'number' || !Number.isFinite(val)) return null;
  const floored = Math.floor(val);
  return floored >= 0 ? floored : null;
}

/**
 * Phân tích an toàn `textAnchor` từ metadata hoặc `source_refs`.
 */
export function parseTextCitationAnchor(raw: unknown): TextCitationAnchor | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }

  const obj = raw as Record<string, unknown>;
  const startLine = readPositiveInt(obj.startLine ?? obj.start_line);
  const rawEndLine = readPositiveInt(obj.endLine ?? obj.end_line);
  const charStart = readNonNegativeInt(obj.charStart ?? obj.char_start) ?? 0;
  const rawCharEnd = readNonNegativeInt(obj.charEnd ?? obj.char_end);
  const rawQuoteExact = obj.quoteExact ?? obj.quote_exact;
  const quoteExact = typeof rawQuoteExact === 'string' ? rawQuoteExact.trim() : '';

  if (startLine === null || !quoteExact) {
    return undefined;
  }

  const endLine = rawEndLine !== null && rawEndLine >= startLine ? rawEndLine : startLine;
  const charEnd = rawCharEnd !== null && rawCharEnd >= charStart ? rawCharEnd : charStart + quoteExact.length;

  const rawPrefix = obj.quotePrefix ?? obj.quote_prefix;
  const quotePrefix = typeof rawPrefix === 'string' && rawPrefix.length > 0 ? rawPrefix : undefined;

  const rawSuffix = obj.quoteSuffix ?? obj.quote_suffix;
  const quoteSuffix = typeof rawSuffix === 'string' && rawSuffix.length > 0 ? rawSuffix : undefined;

  const rawHeadingPath = obj.headingPath ?? obj.heading_path;
  const headingPath = Array.isArray(rawHeadingPath)
    ? rawHeadingPath.filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
    : undefined;

  return {
    startLine,
    endLine,
    charStart,
    charEnd,
    quoteExact,
    ...(quotePrefix ? { quotePrefix } : {}),
    ...(quoteSuffix ? { quoteSuffix } : {}),
    ...(headingPath && headingPath.length > 0 ? { headingPath } : {}),
  };
}

/**
 * Chuẩn hóa an toàn dữ liệu `source_refs` / `sourceRefs` nhận từ API.
 * Đảm bảo luôn trả về mảng hợp lệ (tương thích ngược với bản ghi cũ null/undefined).
 */
export function parseClientSourceRefs(raw: unknown): SourceReference[] {
  if (!Array.isArray(raw)) return [];

  const result: SourceReference[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }

    const obj = entry as Record<string, unknown>;
    if (typeof obj.documentId !== 'string' || !obj.documentId.trim()) {
      continue;
    }

    const pageNumbers = Array.isArray(obj.pageNumbers)
      ? obj.pageNumbers.filter(
          (p): p is number => typeof p === 'number' && Number.isFinite(p) && p > 0
        )
      : [];

    const headings = Array.isArray(obj.headings)
      ? obj.headings.filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
      : undefined;

    const bboxes = Array.isArray(obj.bboxes) ? obj.bboxes : undefined;
    const textAnchor = parseTextCitationAnchor(obj.textAnchor ?? obj.text_anchor);

    result.push({
      documentId: obj.documentId,
      fileName:
        typeof obj.fileName === 'string' && obj.fileName.trim()
          ? obj.fileName
          : 'Tài liệu',
      ...(typeof obj.chunkId === 'string' && obj.chunkId ? { chunkId: obj.chunkId } : {}),
      ...(typeof obj.chunkIndex === 'number' && Number.isFinite(obj.chunkIndex)
        ? { chunkIndex: obj.chunkIndex }
        : {}),
      pageNumbers: pageNumbers.length > 0 ? pageNumbers : textAnchor ? [] : [1],
      ...(bboxes && bboxes.length > 0 ? { bboxes } : {}),
      ...(headings && headings.length > 0 ? { headings } : {}),
      ...(typeof obj.snippet === 'string' && obj.snippet.trim()
        ? { snippet: obj.snippet.trim() }
        : {}),
      ...(textAnchor ? { textAnchor } : {}),
    });
  }

  return result;
}

/**
 * Định dạng nhãn trang ngắn gọn (ví dụ: "Trang 3" hoặc "Trang 3–5").
 */
export function formatSourcePageLabel(pageNumbers: number[]): string {
  if (!Array.isArray(pageNumbers) || pageNumbers.length === 0) return 'Trang 1';
  const first = pageNumbers[0];
  const last = pageNumbers[pageNumbers.length - 1];
  return first === last ? `Trang ${first}` : `Trang ${first}–${last}`;
}
