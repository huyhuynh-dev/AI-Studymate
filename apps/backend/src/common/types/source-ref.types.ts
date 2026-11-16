/**
 * Hợp đồng dữ liệu chuẩn cho liên kết nguồn gốc (Evidence Grounding)
 * giữa Học liệu (Flashcard / QuizQuestion) và Tài liệu gốc (document_chunks / PDF bboxes).
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
            pageNumbers: pageNumbers.length > 0 ? pageNumbers : [1],
            ...(bboxes && bboxes.length > 0 ? { bboxes } : {}),
            ...(headings && headings.length > 0 ? { headings } : {}),
            ...(typeof obj.snippet === 'string' && obj.snippet.trim()
                ? { snippet: obj.snippet.trim() }
                : {}),
        });
    }

    return result;
}
