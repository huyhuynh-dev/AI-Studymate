import type { TextCitationAnchor } from '../../common/types/source-ref.types.js';
import {
  BINARY_DOCUMENT_EXTENSION_TO_MIME,
  EDITABLE_TEXT_EXTENSION_TO_MIME,
  getFileExtension,
  normalizeMimeType,
} from '../constants/editable-document.constants.js';
import type { DoclingChunkResult } from '../services/docling.service.js';

const QUOTE_CONTEXT_CHARS = 64;
const MAX_QUOTE_EXACT_CHARS = 1500;
const CHUNK_OVERLAP_LOOKBACK_CHARS = 120;

const EDITABLE_TEXT_MIME_PREFIXES = ['text/'];
const EDITABLE_TEXT_EXACT_MIMES = new Set<string>(
  Object.values(EDITABLE_TEXT_EXTENSION_TO_MIME),
);
const PAGED_MIME_SET = new Set<string>(
  Object.values(BINARY_DOCUMENT_EXTENSION_TO_MIME),
);

interface CollapsedTextIndex {
  collapsed: string;
  rawStarts: number[];
  rawEnds: number[];
}

export interface AlignChunksOptions {
  fileName?: string;
  mimeType?: string;
  unwrapStructuredWrapper?: boolean;
}

export interface ChunkLocationFormatInput {
  fileName?: string | null;
  mimeType?: string | null;
  pageNumbers?: number[];
  textAnchor?: TextCitationAnchor | null;
  headings?: string[];
  chunkIndex?: number;
}

/**
 * Xác định tệp thuộc nhóm tài liệu phân trang (PDF/Office/Ảnh) hay văn bản liên tục (Plain Text/Markdown/Code/Markup).
 */
export function isPagedDocumentFileName(
  fileName?: string | null,
  mimeType?: string | null,
): boolean {
  const ext = fileName ? getFileExtension(fileName) : '';
  if (ext && EDITABLE_TEXT_EXTENSION_TO_MIME[ext]) {
    return false;
  }
  if (ext && BINARY_DOCUMENT_EXTENSION_TO_MIME[ext]) {
    return true;
  }

  const normalizedMime = normalizeMimeType(mimeType);
  if (normalizedMime) {
    if (PAGED_MIME_SET.has(normalizedMime)) {
      return true;
    }
    if (
      EDITABLE_TEXT_EXACT_MIMES.has(normalizedMime) ||
      EDITABLE_TEXT_MIME_PREFIXES.some((prefix) =>
        normalizedMime.startsWith(prefix),
      )
    ) {
      return false;
    }
  }

  return true;
}

export function isCsvDocumentFile(
  fileName?: string | null,
  mimeType?: string | null,
): boolean {
  const ext = fileName ? getFileExtension(fileName) : '';
  if (ext === 'csv') return true;
  return normalizeMimeType(mimeType) === 'text/csv';
}

/**
 * Định dạng nhãn vị trí đa hình cho ngữ cảnh AI Prompt & dữ liệu nguồn Backend.
 * - Tài liệu phân trang: "Trang 3" / "Trang 3–5" / "Trang 3, 7"
 * - Tài liệu văn bản có textAnchor: "Dòng 42–58" hoặc "Hàng 15–22" (CSV)
 * - Tài liệu văn bản cũ chưa có textAnchor: "Mục: ..." hoặc "Đoạn #N"
 */
export function formatBackendChunkLocationLabel(
  input: ChunkLocationFormatInput,
): string {
  if (!isPagedDocumentFileName(input.fileName, input.mimeType)) {
    const anchor = input.textAnchor;
    if (anchor) {
      const unit = isCsvDocumentFile(input.fileName, input.mimeType)
        ? 'Hàng'
        : 'Dòng';
      return anchor.startLine === anchor.endLine
        ? `${unit} ${anchor.startLine}`
        : `${unit} ${anchor.startLine}–${anchor.endLine}`;
    }

    const headings = input.headings?.filter((h) => h.trim().length > 0) ?? [];
    if (headings.length > 0) {
      return `Mục: ${headings[headings.length - 1]}`;
    }
    if (
      typeof input.chunkIndex === 'number' &&
      Number.isFinite(input.chunkIndex) &&
      input.chunkIndex >= 0
    ) {
      return `Đoạn #${Math.floor(input.chunkIndex) + 1}`;
    }
    return 'Văn bản';
  }

  const unique = Array.from(
    new Set(
      (input.pageNumbers ?? []).filter(
        (n) => typeof n === 'number' && Number.isFinite(n) && n > 0,
      ),
    ),
  ).sort((a, b) => a - b);

  if (unique.length === 0) return 'Trang 1';
  if (unique.length === 1) return `Trang ${unique[0]}`;

  const isContiguous = unique.every(
    (page, idx) => idx === 0 || page === unique[idx - 1] + 1,
  );
  if (isContiguous) {
    return `Trang ${unique[0]}–${unique[unique.length - 1]}`;
  }
  return `Trang ${unique.join(', ')}`;
}

/**
 * Xây dựng mảng vị trí ký tự bắt đầu của từng dòng (1-based line index = array index + 1).
 */
export function buildLineOffsetTable(normalizedSource: string): number[] {
  const lineStarts: number[] = [0];
  for (let i = 0; i < normalizedSource.length; i++) {
    if (normalizedSource.charCodeAt(i) === 10) {
      lineStarts.push(i + 1);
    }
  }
  return lineStarts;
}

/**
 * Quy đổi vị trí ký tự (0-based) sang số dòng (1-based) bằng binary search O(log L).
 */
export function charOffsetToLine(
  lineStarts: number[],
  charOffset: number,
): number {
  if (lineStarts.length === 0) return 1;
  const clamped = Math.max(0, charOffset);
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lineStarts[mid] <= clamped) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return Math.max(1, high + 1);
}

/**
 * Xây dựng chuỗi rút gọn khoảng trắng kèm bảng ánh xạ ngược về chỉ số ký tự gốc.
 */
function buildCollapsedWhitespaceIndex(text: string): CollapsedTextIndex {
  const chars: string[] = [];
  const rawStarts: number[] = [];
  const rawEnds: number[] = [];

  let i = 0;
  const n = text.length;

  // Bỏ qua khoảng trắng đầu để tránh lệch khi so khớp
  while (i < n && /\s/.test(text[i])) {
    i++;
  }

  while (i < n) {
    if (/\s/.test(text[i])) {
      const wsStart = i;
      while (i < n && /\s/.test(text[i])) {
        i++;
      }
      if (i < n) {
        chars.push(' ');
        rawStarts.push(wsStart);
        rawEnds.push(i);
      }
    } else {
      chars.push(text[i]);
      rawStarts.push(i);
      rawEnds.push(i + 1);
      i++;
    }
  }

  return {
    collapsed: chars.join(''),
    rawStarts,
    rawEnds,
  };
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Loại bỏ các lớp bọc nhân tạo do `prepareTextForHybridChunking` thêm vào (# fileName + ```lang ... ```)
 * hoặc heading prefix do Docling HybridChunker gắn thêm ở đầu `chunk.content`.
 */
function buildSearchCandidatesForChunk(
  chunk: DoclingChunkResult,
  options?: AlignChunksOptions,
): string[] {
  const rawList = [chunk.rawContent, chunk.content]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim());

  const candidates: string[] = [];
  const seen = new Set<string>();

  const pushCandidate = (val: string): void => {
    const trimmed = val.trim();
    if (trimmed.length > 0 && !seen.has(trimmed)) {
      seen.add(trimmed);
      candidates.push(trimmed);
    }
  };

  for (const raw of rawList) {
    let cleaned = raw;

    if (options?.unwrapStructuredWrapper) {
      if (options.fileName) {
        const headerRegex = new RegExp(
          `^#\\s+${escapeRegExp(options.fileName.trim())}\\s*\\n+`,
        );
        cleaned = cleaned.replace(headerRegex, '');
      }
      cleaned = cleaned.replace(/^```[a-zA-Z0-9_-]*\n/, '');
      cleaned = cleaned.replace(/\n```$/, '');
      pushCandidate(cleaned);
    }

    pushCandidate(raw);

    // Nếu chunk.content được Docling ghép headings ở đầu (vd: "Heading 1\nBody"), thử thêm bản đã bỏ headings đầu
    const headings = chunk.headings ?? [];
    if (headings.length > 0) {
      let stripped = cleaned;
      for (const heading of headings) {
        const hTrimmed = heading.trim();
        if (!hTrimmed) continue;
        const hPattern = new RegExp(
          `^(?:#+\\s*)?${escapeRegExp(hTrimmed)}\\s*\\n+`,
        );
        stripped = stripped.replace(hPattern, '');
      }
      pushCandidate(stripped);
    }
  }

  return candidates;
}

function findRawRangeFromStartOffsets(
  normalizedSource: string,
  collapsedIndex: CollapsedTextIndex,
  candidate: string,
  searchStartOffsets: number[],
): { start: number; end: number } | null {
  // Pass A: Khớp chính xác chuỗi gốc
  for (const startChar of searchStartOffsets) {
    const idx = normalizedSource.indexOf(candidate, startChar);
    if (idx !== -1) {
      return { start: idx, end: idx + candidate.length };
    }
  }

  // Pass B: Khớp chuẩn hóa khoảng trắng (\s+ -> ' ')
  const collapsedCandidate = collapseWhitespace(candidate);
  if (!collapsedCandidate || collapsedIndex.collapsed.length === 0) {
    return null;
  }

  for (const startChar of searchStartOffsets) {
    const normStart = findCollapsedIndexForRawOffset(
      collapsedIndex.rawStarts,
      startChar,
    );
    const normIdx = collapsedIndex.collapsed.indexOf(
      collapsedCandidate,
      normStart,
    );
    if (normIdx !== -1) {
      const endNormIdx = normIdx + collapsedCandidate.length - 1;
      const start = collapsedIndex.rawStarts[normIdx];
      const end = collapsedIndex.rawEnds[endNormIdx];
      if (typeof start === 'number' && typeof end === 'number' && end > start) {
        return { start, end };
      }
    }
  }

  // Pass C: Định vị theo dòng đầu & dòng cuối (xử lý trường hợp Docling re-pad bảng Markdown / danh sách)
  const meaningfulLines = candidate
    .split('\n')
    .map((line) => collapseWhitespace(line))
    .filter((line) => line.length >= 12);

  if (meaningfulLines.length >= 2) {
    const firstFragment = meaningfulLines[0].slice(0, 72);
    const lastFragment = meaningfulLines[meaningfulLines.length - 1].slice(
      -72,
    );

    if (firstFragment.length >= 12 && lastFragment.length >= 12) {
      for (const startChar of searchStartOffsets) {
        const normStart = findCollapsedIndexForRawOffset(
          collapsedIndex.rawStarts,
          startChar,
        );
        const firstNormIdx = collapsedIndex.collapsed.indexOf(
          firstFragment,
          normStart,
        );
        if (firstNormIdx === -1) continue;

        const lastNormIdx = collapsedIndex.collapsed.indexOf(
          lastFragment,
          firstNormIdx,
        );
        if (lastNormIdx === -1) continue;

        const spanStart = collapsedIndex.rawStarts[firstNormIdx];
        const spanEnd =
          collapsedIndex.rawEnds[lastNormIdx + lastFragment.length - 1];
        const maxAllowedSpan = candidate.length * 3 + 600;

        if (
          typeof spanStart === 'number' &&
          typeof spanEnd === 'number' &&
          spanEnd > spanStart &&
          spanEnd - spanStart <= maxAllowedSpan
        ) {
          return { start: spanStart, end: spanEnd };
        }
      }
    }
  }

  return null;
}

function findCollapsedIndexForRawOffset(
  rawStarts: number[],
  rawOffset: number,
): number {
  if (rawOffset <= 0 || rawStarts.length === 0) return 0;
  let low = 0;
  let high = rawStarts.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (rawStarts[mid] < rawOffset) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return Math.min(rawStarts.length, low);
}

function trimMatchedSpan(
  source: string,
  start: number,
  end: number,
): { start: number; end: number } | null {
  let s = Math.max(0, start);
  let e = Math.min(source.length, end);
  while (s < e && /\s/.test(source[s])) {
    s++;
  }
  while (e > s && /\s/.test(source[e - 1])) {
    e--;
  }
  return e > s ? { start: s, end: e } : null;
}

function buildTextCitationAnchor(
  normalizedSource: string,
  lineStarts: number[],
  rawStart: number,
  rawEnd: number,
  headings: string[],
): TextCitationAnchor | null {
  const trimmed = trimMatchedSpan(normalizedSource, rawStart, rawEnd);
  if (!trimmed) return null;

  const fullSlice = normalizedSource.slice(trimmed.start, trimmed.end);
  if (!fullSlice) return null;

  const quoteExact =
    fullSlice.length <= MAX_QUOTE_EXACT_CHARS
      ? fullSlice
      : fullSlice.slice(0, MAX_QUOTE_EXACT_CHARS).trimEnd();

  if (!quoteExact) return null;

  const quotePrefix = normalizedSource.slice(
    Math.max(0, trimmed.start - QUOTE_CONTEXT_CHARS),
    trimmed.start,
  );
  const quoteSuffix = normalizedSource.slice(
    trimmed.end,
    Math.min(normalizedSource.length, trimmed.end + QUOTE_CONTEXT_CHARS),
  );

  const cleanHeadings = headings.filter((h) => h.trim().length > 0);

  return {
    startLine: charOffsetToLine(lineStarts, trimmed.start),
    endLine: charOffsetToLine(lineStarts, Math.max(trimmed.start, trimmed.end - 1)),
    charStart: trimmed.start,
    charEnd: trimmed.end,
    quoteExact,
    ...(quotePrefix.length > 0 ? { quotePrefix } : {}),
    ...(quoteSuffix.length > 0 ? { quoteSuffix } : {}),
    ...(cleanHeadings.length > 0 ? { headingPath: cleanHeadings } : {}),
  };
}

/**
 * Đối chiếu tuần tự các chunk từ Docling HybridChunker về tọa độ gốc trong tệp văn bản
 * (startLine, endLine, charStart, charEnd, quoteExact, quotePrefix, quoteSuffix)
 * và lưu vào `chunk.metadata.text_anchor`.
 */
export function alignChunksToSourceText(
  rawSourceText: string,
  chunks: DoclingChunkResult[],
  options?: AlignChunksOptions,
): DoclingChunkResult[] {
  if (!rawSourceText || chunks.length === 0) {
    return chunks;
  }

  const normalizedSource = rawSourceText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  if (!normalizedSource.trim()) {
    return chunks;
  }

  const lineStarts = buildLineOffsetTable(normalizedSource);
  const collapsedIndex = buildCollapsedWhitespaceIndex(normalizedSource);

  const indexedChunks = chunks.map((chunk, arrayPos) => ({ chunk, arrayPos }));
  indexedChunks.sort((a, b) => a.chunk.index - b.chunk.index);

  let forwardCursor = 0;
  const alignedByArrayPos = new Map<number, DoclingChunkResult>();

  for (const { chunk, arrayPos } of indexedChunks) {
    const candidates = buildSearchCandidatesForChunk(chunk, options);
    const searchStartOffsets = [
      forwardCursor,
      ...(forwardCursor > CHUNK_OVERLAP_LOOKBACK_CHARS
        ? [forwardCursor - CHUNK_OVERLAP_LOOKBACK_CHARS]
        : []),
      0,
    ];
    const dedupedOffsets = Array.from(new Set(searchStartOffsets));

    let matchedRange: { start: number; end: number } | null = null;
    for (const candidate of candidates) {
      matchedRange = findRawRangeFromStartOffsets(
        normalizedSource,
        collapsedIndex,
        candidate,
        dedupedOffsets,
      );
      if (matchedRange) {
        break;
      }
    }

    if (!matchedRange) {
      alignedByArrayPos.set(arrayPos, chunk);
      continue;
    }

    const anchor = buildTextCitationAnchor(
      normalizedSource,
      lineStarts,
      matchedRange.start,
      matchedRange.end,
      chunk.headings ?? [],
    );

    if (!anchor) {
      alignedByArrayPos.set(arrayPos, chunk);
      continue;
    }

    if (matchedRange.end > forwardCursor) {
      forwardCursor = matchedRange.end;
    }

    const existingMeta =
      chunk.metadata &&
      typeof chunk.metadata === 'object' &&
      !Array.isArray(chunk.metadata)
        ? chunk.metadata
        : {};

    alignedByArrayPos.set(arrayPos, {
      ...chunk,
      metadata: {
        ...existingMeta,
        text_anchor: anchor,
      },
    });
  }

  return chunks.map((_, idx) => alignedByArrayPos.get(idx) ?? chunks[idx]);
}
