import {
    extractTextAnchorFromChunkMetadata,
    type SourceReferenceItem,
    type TextCitationAnchor,
} from '../../common/types/source-ref.types.js';
import {
    formatBackendChunkLocationLabel,
    isPagedDocumentFileName,
} from '../../documents/helpers/text-anchor.helper.js';

export interface ChunkableDocumentChunk {
    id?: string;
    chunkIndex: number;
    content: string;
    rawContent?: string | null;
    pageNumbers: number[];
    headings: string[];
    bboxes?: unknown;
    metadata?: unknown;
    textAnchor?: TextCitationAnchor;
}

export interface ChunkableDocumentInput {
    id: string;
    fileName: string;
    rawText: string;
    chunks: ChunkableDocumentChunk[];
}

export interface PackedDocumentEntry {
    id: string;
    name: string;
    text: string;
    truncated: boolean;
}

export interface PackedChunkContext {
    docs: PackedDocumentEntry[];
    combinedContext: string;
    chunkRefMap: Map<number, SourceReferenceItem>;
    totalChunksIncluded: number;
    truncatedDocCount: number;
}

interface NormalizedChunkItem {
    id?: string;
    chunkIndex: number;
    body: string;
    pageNumbers: number[];
    headings: string[];
    bboxes?: unknown[];
    textAnchor?: TextCitationAnchor;
}

const SNIPPET_MAX_CHARS = 240;
const CHUNK_HEADER_OVERHEAD = 90;

function cleanSnippet(text: string, maxLength = SNIPPET_MAX_CHARS): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeDocumentChunks(doc: ChunkableDocumentInput): NormalizedChunkItem[] {
    const isPaged = isPagedDocumentFileName(doc.fileName);

    const validChunks = [...doc.chunks]
        .sort((a, b) => a.chunkIndex - b.chunkIndex)
        .map((c): NormalizedChunkItem | null => {
            const body = (c.rawContent?.trim() || c.content.trim());
            if (!body) return null;
            const pageNumbers =
                Array.isArray(c.pageNumbers) && c.pageNumbers.length > 0
                    ? c.pageNumbers.filter((p) => typeof p === 'number' && Number.isFinite(p) && p > 0)
                    : [];
            const headings = Array.isArray(c.headings)
                ? c.headings.map((h) => h.trim()).filter(Boolean)
                : [];
            const textAnchor = c.textAnchor ?? extractTextAnchorFromChunkMetadata(c.metadata);
            return {
                id: c.id,
                chunkIndex: c.chunkIndex,
                body,
                pageNumbers: isPaged ? (pageNumbers.length > 0 ? pageNumbers : [1]) : [],
                headings,
                bboxes: Array.isArray(c.bboxes) && c.bboxes.length > 0 ? c.bboxes : undefined,
                ...(textAnchor ? { textAnchor } : {}),
            };
        })
        .filter((item): item is NormalizedChunkItem => item !== null);

    if (validChunks.length > 0) {
        return validChunks;
    }

    const fallbackText = doc.rawText.trim();
    if (!fallbackText) {
        return [];
    }

    return [
        {
            chunkIndex: 0,
            body: fallbackText,
            pageNumbers: isPaged ? [1] : [],
            headings: [],
        },
    ];
}

/**
 * Chọn các chunk phân bố đều từ đầu đến cuối tài liệu khi tài liệu vượt quá ngân sách ký tự,
 * giúp giữ toàn bộ ranh giới chunk hợp lệ và không bỏ sót các chương cuối sách.
 */
function selectStratifiedChunks(
    chunks: NormalizedChunkItem[],
    docBudget: number
): { selected: NormalizedChunkItem[]; truncated: boolean } {
    const totalLength = chunks.reduce(
        (sum, c) => sum + c.body.length + CHUNK_HEADER_OVERHEAD,
        0
    );

    if (totalLength <= docBudget) {
        return { selected: chunks, truncated: false };
    }

    const keepRatio = Math.min(1, Math.max(0.01, docBudget / Math.max(1, totalLength)));
    const selected: NormalizedChunkItem[] = [];
    let used = 0;
    let credit = 1; // Ưu tiên giữ chunk đầu tiên làm điểm neo ngữ cảnh

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const cost = chunk.body.length + CHUNK_HEADER_OVERHEAD;
        if (i > 0) {
            credit += keepRatio;
        }
        if (credit >= 1 && used + cost <= docBudget) {
            selected.push(chunk);
            used += cost;
            credit -= 1;
        }
    }

    if (selected.length === 0 && chunks.length > 0) {
        const first = chunks[0];
        const maxBodyChars = Math.max(120, docBudget - CHUNK_HEADER_OVERHEAD);
        selected.push({
            ...first,
            body: first.body.slice(0, maxBodyChars),
        });
    }

    return { selected, truncated: true };
}

/**
 * Đóng gói danh sách tài liệu & `document_chunks` thành ngữ cảnh có đánh số `[CHUNK #N]`
 * phục vụ sinh Flashcard / Quiz gắn tọa độ nguồn:
 * - Phân bổ ngân sách công bằng theo thuật toán Water-Filling giữa nhiều tài liệu.
 * - Dùng Stratified Sampling khi tài liệu dài vượt ngưỡng để bao phủ cả đầu, giữa và cuối tài liệu.
 * - Tự động fallback về `rawText` (Trang 1) nếu tài liệu chưa có bản ghi trong `document_chunks`.
 */
export function packChunkedDocuments(
    documents: ChunkableDocumentInput[],
    budget: number
): PackedChunkContext {
    const prepared = documents
        .map((doc) => {
            const chunks = normalizeDocumentChunks(doc);
            const estimatedLength = chunks.reduce(
                (sum, c) => sum + c.body.length + CHUNK_HEADER_OVERHEAD,
                0
            );
            return { doc, chunks, estimatedLength };
        })
        .filter((entry) => entry.chunks.length > 0);

    const totalLength = prepared.reduce((sum, entry) => sum + entry.estimatedLength, 0);
    const allocMap = new Map<string, number>();

    if (totalLength <= budget) {
        for (const entry of prepared) {
            allocMap.set(entry.doc.id, entry.estimatedLength);
        }
    } else {
        let remaining = budget;
        let left = prepared.length;
        for (const entry of [...prepared].sort(
            (a, b) => a.estimatedLength - b.estimatedLength
        )) {
            const take = Math.min(entry.estimatedLength, Math.floor(remaining / left));
            allocMap.set(entry.doc.id, take);
            remaining -= take;
            left -= 1;
        }
    }

    const chunkRefMap = new Map<number, SourceReferenceItem>();
    const packedDocs: PackedDocumentEntry[] = [];
    let nextRefIndex = 1;
    let totalChunksIncluded = 0;

    for (const entry of prepared) {
        const docBudget = allocMap.get(entry.doc.id) ?? 0;
        const { selected, truncated } = selectStratifiedChunks(entry.chunks, docBudget);

        const formattedChunks: string[] = [];
        for (const chunk of selected) {
            const refIndex = nextRefIndex++;
            const locationLabel = formatBackendChunkLocationLabel({
                fileName: entry.doc.fileName,
                pageNumbers: chunk.pageNumbers,
                textAnchor: chunk.textAnchor,
                headings: chunk.headings,
                chunkIndex: chunk.chunkIndex,
            });
            const headingLabel =
                chunk.headings.length > 0 && !locationLabel.startsWith('Mục: ')
                    ? ` | Mục: ${chunk.headings.join(' > ')}`
                    : '';
            const header = `[CHUNK #${refIndex} | ${locationLabel}${headingLabel}]`;

            formattedChunks.push(`${header}\n${chunk.body}`);
            chunkRefMap.set(refIndex, {
                documentId: entry.doc.id,
                fileName: entry.doc.fileName || entry.doc.id,
                ...(chunk.id ? { chunkId: chunk.id } : {}),
                chunkIndex: chunk.chunkIndex,
                pageNumbers: chunk.pageNumbers,
                ...(chunk.bboxes ? { bboxes: chunk.bboxes } : {}),
                ...(chunk.headings.length > 0 ? { headings: chunk.headings } : {}),
                ...(chunk.textAnchor ? { textAnchor: chunk.textAnchor } : {}),
                snippet: cleanSnippet(chunk.body),
            });
            totalChunksIncluded++;
        }

        packedDocs.push({
            id: entry.doc.id,
            name: entry.doc.fileName || entry.doc.id,
            text: formattedChunks.join('\n\n'),
            truncated,
        });
    }

    const combinedContext = packedDocs
        .map((doc, idx) => `=== TÀI LIỆU ${idx + 1}: ${doc.name} ===\n${doc.text}`)
        .join('\n\n');

    return {
        docs: packedDocs,
        combinedContext,
        chunkRefMap,
        totalChunksIncluded,
        truncatedDocCount: packedDocs.filter((d) => d.truncated).length,
    };
}

/**
 * Tra cứu đối tượng `SourceReferenceItem` từ mã `CHUNK #N` do LLM trả về.
 * Trả về mảng rỗng nếu không tìm thấy chỉ số hợp lệ (tránh gắn nhầm trang).
 */
export function resolveSourceRefs(
    refIndex: number | null | undefined,
    chunkRefMap?: Map<number, SourceReferenceItem>
): SourceReferenceItem[] {
    if (
        !chunkRefMap ||
        typeof refIndex !== 'number' ||
        !Number.isInteger(refIndex) ||
        refIndex <= 0
    ) {
        return [];
    }
    const found = chunkRefMap.get(refIndex);
    return found ? [found] : [];
}
