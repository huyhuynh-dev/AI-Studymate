export interface ChunkOptions {
    /** Số ký tự tối đa mỗi chunk (mặc định ~2000 ký tự ≈ 500 tokens) */
    chunkSize?: number;
    /** Số ký tự gối đầu giữa 2 chunk liên tiếp (mặc định ~200 ký tự ≈ 50 tokens) */
    chunkOverlap?: number;
}

export interface TextChunk {
    index: number;
    content: string;
}

const DEFAULT_CHUNK_SIZE = 2000;   // ~500 tokens
const DEFAULT_CHUNK_OVERLAP = 200; // ~50 tokens

const SEPARATORS = ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' ', ''];

/**
 * Chia văn bản thành các chunk theo chiến lược Recursive Character Text Splitter.
 * Ưu tiên tách theo đoạn văn (\n\n) -> dòng (\n) -> câu (. ! ?) -> mệnh đề (; ,) -> từ ( ) -> ký tự.
 */
export function chunkText(text: string, options?: ChunkOptions): TextChunk[] {
    const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const chunkOverlap = Math.min(
        options?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP,
        Math.floor(chunkSize / 2)
    );

    if (!text || text.trim().length === 0) {
        return [];
    }

    const cleanText = text.replace(/\r\n/g, '\n').trim();

    if (cleanText.length <= chunkSize) {
        return [{ index: 0, content: cleanText }];
    }

    const rawChunks = splitRecursively(cleanText, SEPARATORS, chunkSize, chunkOverlap);

    return rawChunks
        .map((c) => c.trim())
        .filter((c) => c.length > 0)
        .map((content, index) => ({
            index,
            content,
        }));
}

function splitRecursively(
    text: string,
    separators: string[],
    chunkSize: number,
    chunkOverlap: number
): string[] {
    const finalChunks: string[] = [];

    if (text.length <= chunkSize) {
        if (text.trim().length > 0) {
            finalChunks.push(text.trim());
        }
        return finalChunks;
    }

    // Chọn separator phù hợp đầu tiên có xuất hiện trong text
    let separator = separators[separators.length - 1];
    let nextSeparators: string[] = [];

    for (let i = 0; i < separators.length; i++) {
        const sep = separators[i];
        if (sep === '') {
            separator = '';
            nextSeparators = [];
            break;
        }
        if (text.includes(sep)) {
            separator = sep;
            nextSeparators = separators.slice(i + 1);
            break;
        }
    }

    // Nếu buộc phải cắt theo từng ký tự (không có separator nào khớp)
    if (separator === '') {
        const step = Math.max(1, chunkSize - chunkOverlap);
        for (let i = 0; i < text.length; i += step) {
            const slice = text.slice(i, i + chunkSize).trim();
            if (slice.length > 0) {
                finalChunks.push(slice);
            }
            if (i + chunkSize >= text.length) break;
        }
        return finalChunks;
    }

    const splits = text.split(separator);
    const goodSplits: string[] = [];

    const mergeSplits = (items: string[], sep: string): string[] => {
        const docs: string[] = [];
        let currentDoc: string[] = [];
        let totalLen = 0;

        for (const item of items) {
            const itemLen = item.length;
            const sepLen = currentDoc.length > 0 ? sep.length : 0;

            if (totalLen + sepLen + itemLen > chunkSize && currentDoc.length > 0) {
                const doc = currentDoc.join(sep).trim();
                if (doc.length > 0) {
                    docs.push(doc);
                }

                // Giữ lại phần gối đầu (overlap) cho chunk kế tiếp
                while (
                    currentDoc.length > 0 &&
                    (totalLen > chunkOverlap ||
                        (totalLen + (currentDoc.length > 0 ? sep.length : 0) + itemLen > chunkSize &&
                            totalLen > 0))
                ) {
                    const removed = currentDoc.shift()!;
                    totalLen -= removed.length + (currentDoc.length > 0 ? sep.length : 0);
                }
            }

            currentDoc.push(item);
            totalLen += (currentDoc.length > 1 ? sep.length : 0) + itemLen;
        }

        if (currentDoc.length > 0) {
            const doc = currentDoc.join(sep).trim();
            if (doc.length > 0) {
                docs.push(doc);
            }
        }

        return docs;
    };

    for (const s of splits) {
        if (s.length <= chunkSize) {
            goodSplits.push(s);
        } else {
            if (goodSplits.length > 0) {
                finalChunks.push(...mergeSplits(goodSplits, separator));
                goodSplits.length = 0;
            }
            if (nextSeparators.length === 0) {
                finalChunks.push(...splitRecursively(s, [''], chunkSize, chunkOverlap));
            } else {
                finalChunks.push(...splitRecursively(s, nextSeparators, chunkSize, chunkOverlap));
            }
        }
    }

    if (goodSplits.length > 0) {
        finalChunks.push(...mergeSplits(goodSplits, separator));
    }

    return finalChunks;
}
