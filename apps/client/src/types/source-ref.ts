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

/**
 * Định dạng nhãn trang ngắn gọn (ví dụ: "Trang 3" hoặc "Trang 3–5").
 */
export function formatSourcePageLabel(pageNumbers: number[]): string {
  if (!Array.isArray(pageNumbers) || pageNumbers.length === 0) return 'Trang 1';
  const first = pageNumbers[0];
  const last = pageNumbers[pageNumbers.length - 1];
  return first === last ? `Trang ${first}` : `Trang ${first}–${last}`;
}
