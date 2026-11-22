/**
 * Neo trích dẫn chuẩn W3C-style cho tài liệu văn bản thuần, Markdown và dữ liệu có cấu trúc
 * (.md, .txt, .html, .json, .xml, .yaml, .csv, .toml, .log).
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
 * Hợp đồng dữ liệu chuẩn cho liên kết nguồn gốc (Evidence Grounding)
 * giữa Học liệu (Flashcard / QuizQuestion) và Tài liệu gốc (document_chunks / PDF bboxes / Text anchors).
 */
export interface SourceReferenceItem {
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

function readFiniteNonNegativeInt(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const floored = Math.floor(value);
    return floored >= 0 ? floored : null;
}

function readFinitePositiveInt(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const floored = Math.floor(value);
    return floored >= 1 ? floored : null;
}

/**
 * Phân tích an toàn một object thô thành `TextCitationAnchor` hợp lệ.
 * Trả về `undefined` nếu thiếu thông tin bắt buộc (startLine/endLine/quoteExact).
 */
export function parseTextCitationAnchor(raw: unknown): TextCitationAnchor | undefined {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return undefined;
    }

    const obj = raw as Record<string, unknown>;
    const startLine = readFinitePositiveInt(obj.startLine ?? obj.start_line);
    const rawEndLine = readFinitePositiveInt(obj.endLine ?? obj.end_line);
    const charStart = readFiniteNonNegativeInt(obj.charStart ?? obj.char_start) ?? 0;
    const rawCharEnd = readFiniteNonNegativeInt(obj.charEnd ?? obj.char_end);
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
 * Trích xuất gọn nhẹ `TextCitationAnchor` từ trường JSONB `chunk_metadata` trong bảng `document_chunks`.
 */
export function extractTextAnchorFromChunkMetadata(chunkMetadata: unknown): TextCitationAnchor | undefined {
    if (!chunkMetadata || typeof chunkMetadata !== 'object' || Array.isArray(chunkMetadata)) {
        return undefined;
    }
    const meta = chunkMetadata as Record<string, unknown>;
    return parseTextCitationAnchor(meta.text_anchor ?? meta.textAnchor);
}

/**
 * Chuẩn hóa an toàn dữ liệu JSONB `source_refs` đọc từ PostgreSQL.
 * Luôn trả về mảng hợp lệ (tương thích ngược với các bản ghi cũ có giá trị null/undefined).
 */
export function parseSourceRefs(raw: unknown): SourceReferenceItem[] {
    if (!Array.isArray(raw)) return [];

    const result: SourceReferenceItem[] = [];
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
