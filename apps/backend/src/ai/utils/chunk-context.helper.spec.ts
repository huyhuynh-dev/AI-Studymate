import { describe, expect, it } from 'vitest';
import { parseSourceRefs } from '../../common/types/source-ref.types.js';
import {
    packChunkedDocuments,
    resolveSourceRefs,
} from './chunk-context.helper.js';

describe('chunk-context.helper & parseSourceRefs', () => {
    it('packs document chunks with sequential [CHUNK #N] headers and builds chunkRefMap', () => {
        const bbox1 = {
            page_no: 2,
            l: 10,
            t: 200,
            r: 300,
            b: 150,
            coord_origin: 'BOTTOMLEFT',
        };
        const packed = packChunkedDocuments(
            [
                {
                    id: 'doc-1',
                    fileName: 'HeDieuHanh.pdf',
                    rawText: 'full raw',
                    chunks: [
                        {
                            id: 'chunk-a',
                            chunkIndex: 1,
                            content: 'Deadlock xảy ra khi có 4 điều kiện Coffman.',
                            rawContent: 'Deadlock xảy ra khi có 4 điều kiện Coffman.',
                            pageNumbers: [2],
                            headings: ['Chương 3', '3.1 Deadlock'],
                            bboxes: [bbox1],
                        },
                        {
                            id: 'chunk-b',
                            chunkIndex: 2,
                            content: 'Giải thuật Banker dùng để tránh deadlock.',
                            rawContent: null,
                            pageNumbers: [3, 4],
                            headings: ['Chương 3', '3.2 Banker'],
                            bboxes: [],
                        },
                    ],
                },
            ],
            50_000
        );

        expect(packed.totalChunksIncluded).toBe(2);
        expect(packed.truncatedDocCount).toBe(0);
        expect(packed.docs[0].text).toContain(
            '[CHUNK #1 | Trang 2 | Mục: Chương 3 > 3.1 Deadlock]'
        );
        expect(packed.docs[0].text).toContain(
            '[CHUNK #2 | Trang 3–4 | Mục: Chương 3 > 3.2 Banker]'
        );

        expect(packed.chunkRefMap.get(1)).toEqual({
            documentId: 'doc-1',
            fileName: 'HeDieuHanh.pdf',
            chunkId: 'chunk-a',
            chunkIndex: 1,
            pageNumbers: [2],
            bboxes: [bbox1],
            headings: ['Chương 3', '3.1 Deadlock'],
            snippet: 'Deadlock xảy ra khi có 4 điều kiện Coffman.',
        });

        expect(packed.chunkRefMap.get(2)?.pageNumbers).toEqual([3, 4]);
        expect(packed.chunkRefMap.get(2)?.bboxes).toBeUndefined();
    });

    it('allocates budget via water-filling and uses stratified sampling for long documents', () => {
        const shortDoc = {
            id: 'short-doc',
            fileName: 'Short.pdf',
            rawText: 'Ngắn gọn',
            chunks: [
                {
                    id: 's-1',
                    chunkIndex: 0,
                    content: 'Nội dung ngắn cần giữ nguyên 100%.',
                    pageNumbers: [1],
                    headings: ['Tóm tắt'],
                },
            ],
        };

        const longChunks = Array.from({ length: 20 }, (_, i) => ({
            id: `long-${i}`,
            chunkIndex: i,
            content: `Đoạn văn số ${i} với nội dung học thuật lặp lại: ${'X'.repeat(220)}`,
            pageNumbers: [i + 1],
            headings: [`Chương ${Math.floor(i / 4) + 1}`],
        }));

        const longDoc = {
            id: 'long-doc',
            fileName: 'LongBook.pdf',
            rawText: 'Long',
            chunks: longChunks,
        };

        const packed = packChunkedDocuments([shortDoc, longDoc], 2_000);

        expect(packed.docs[0].truncated).toBe(false);
        expect(packed.docs[0].text).toContain('Nội dung ngắn cần giữ nguyên 100%.');
        expect(packed.docs[1].truncated).toBe(true);

        // Stratified sampling must include early AND late chunks (not just prefix 0..k)
        const longRefs = [...packed.chunkRefMap.values()].filter(
            (r) => r.documentId === 'long-doc'
        );
        expect(longRefs.length).toBeGreaterThan(2);
        const maxChunkIndex = Math.max(...longRefs.map((r) => r.chunkIndex ?? 0));
        expect(maxChunkIndex).toBeGreaterThanOrEqual(12);
    });

    it('falls back safely to rawText using Đoạn #1 for text and Trang 1 for PDF when a document has no chunks', () => {
        const packedText = packChunkedDocuments(
            [
                {
                    id: 'legacy-doc',
                    fileName: 'Legacy.txt',
                    rawText: 'Nội dung tài liệu thô chưa băm chunk.',
                    chunks: [],
                },
            ],
            10_000
        );

        expect(packedText.totalChunksIncluded).toBe(1);
        expect(packedText.combinedContext).toContain('[CHUNK #1 | Đoạn #1]');
        expect(packedText.chunkRefMap.get(1)).toMatchObject({
            documentId: 'legacy-doc',
            fileName: 'Legacy.txt',
            pageNumbers: [],
            snippet: 'Nội dung tài liệu thô chưa băm chunk.',
        });
        expect(packedText.chunkRefMap.get(1)?.chunkId).toBeUndefined();

        const packedPdf = packChunkedDocuments(
            [
                {
                    id: 'legacy-pdf',
                    fileName: 'Legacy.pdf',
                    rawText: 'Nội dung PDF chưa băm chunk.',
                    chunks: [],
                },
            ],
            10_000
        );
        expect(packedPdf.combinedContext).toContain('[CHUNK #1 | Trang 1]');
        expect(packedPdf.chunkRefMap.get(1)?.pageNumbers).toEqual([1]);
    });

    it('resolveSourceRefs returns exact match and empty array on invalid indices', () => {
        const map = packChunkedDocuments(
            [
                {
                    id: 'doc-1',
                    fileName: 'A.pdf',
                    rawText: 'A',
                    chunks: [
                        {
                            id: 'c-1',
                            chunkIndex: 0,
                            content: 'Chunk 1',
                            pageNumbers: [5],
                            headings: [],
                        },
                    ],
                },
            ],
            10_000
        ).chunkRefMap;

        expect(resolveSourceRefs(1, map)).toHaveLength(1);
        expect(resolveSourceRefs(1, map)[0].pageNumbers).toEqual([5]);
        expect(resolveSourceRefs(0, map)).toEqual([]);
        expect(resolveSourceRefs(99, map)).toEqual([]);
        expect(resolveSourceRefs(-1, map)).toEqual([]);
        expect(resolveSourceRefs(undefined, map)).toEqual([]);
    });

    it('parseSourceRefs safely sanitizes DB jsonb values', () => {
        expect(parseSourceRefs(null)).toEqual([]);
        expect(parseSourceRefs(undefined)).toEqual([]);
        expect(parseSourceRefs([])).toEqual([]);
        expect(parseSourceRefs('invalid')).toEqual([]);
        expect(
            parseSourceRefs([
                { invalid: true },
                { documentId: '   ', fileName: 'EmptyDoc.pdf' },
                {
                    documentId: 'doc-1',
                    fileName: 'Slide.pdf',
                    chunkId: 'chk-1',
                    chunkIndex: 2,
                    pageNumbers: [7, -1, 'bad'],
                    bboxes: [{ page_no: 7, l: 1, t: 2, r: 3, b: 4 }],
                    headings: ['Mục 2', ''],
                    snippet: '  Trích đoạn mẫu  ',
                },
                {
                    documentId: 'doc-2',
                    fileName: 'NoPage.pdf',
                    pageNumbers: [0, -5],
                },
                {
                    documentId: 'doc-md',
                    fileName: 'Lecture.md',
                    chunkId: 'chk-md-1',
                    chunkIndex: 0,
                    pageNumbers: [],
                    textAnchor: {
                        startLine: 10,
                        endLine: 16,
                        charStart: 120,
                        charEnd: 260,
                        quoteExact: 'Gradient Descent updates weights iteratively.',
                    },
                },
            ])
        ).toEqual([
            {
                documentId: 'doc-1',
                fileName: 'Slide.pdf',
                chunkId: 'chk-1',
                chunkIndex: 2,
                pageNumbers: [7],
                bboxes: [{ page_no: 7, l: 1, t: 2, r: 3, b: 4 }],
                headings: ['Mục 2'],
                snippet: 'Trích đoạn mẫu',
            },
            {
                documentId: 'doc-2',
                fileName: 'NoPage.pdf',
                pageNumbers: [1],
            },
            {
                documentId: 'doc-md',
                fileName: 'Lecture.md',
                chunkId: 'chk-md-1',
                chunkIndex: 0,
                pageNumbers: [],
                textAnchor: {
                    startLine: 10,
                    endLine: 16,
                    charStart: 120,
                    charEnd: 260,
                    quoteExact: 'Gradient Descent updates weights iteratively.',
                },
            },
        ]);
    });

    it('formats [CHUNK #N | Dòng X–Y] and [CHUNK #N | Hàng X–Y] for Markdown and CSV with textAnchor', () => {
        const packed = packChunkedDocuments(
            [
                {
                    id: 'doc-md',
                    fileName: 'guide.md',
                    rawText: '',
                    chunks: [
                        {
                            id: 'md-1',
                            chunkIndex: 0,
                            content: 'Backpropagation computes gradients via chain rule.',
                            pageNumbers: [1],
                            headings: ['Neural Nets', 'Backprop'],
                            metadata: {
                                text_anchor: {
                                    startLine: 42,
                                    endLine: 58,
                                    charStart: 800,
                                    charEnd: 1120,
                                    quoteExact: 'Backpropagation computes gradients via chain rule.',
                                    headingPath: ['Neural Nets', 'Backprop'],
                                },
                            },
                        },
                    ],
                },
                {
                    id: 'doc-csv',
                    fileName: 'metrics.csv',
                    rawText: '',
                    chunks: [
                        {
                            id: 'csv-1',
                            chunkIndex: 1,
                            content: 'epoch,loss\n1,0.42\n2,0.18',
                            pageNumbers: [1],
                            headings: [],
                            metadata: {
                                text_anchor: {
                                    startLine: 2,
                                    endLine: 3,
                                    charStart: 11,
                                    charEnd: 24,
                                    quoteExact: '1,0.42\n2,0.18',
                                },
                            },
                        },
                    ],
                },
            ],
            50_000,
        );

        expect(packed.docs[0].text).toContain(
            '[CHUNK #1 | Dòng 42–58 | Mục: Neural Nets > Backprop]',
        );
        expect(packed.docs[1].text).toContain('[CHUNK #2 | Hàng 2–3]');
        expect(packed.chunkRefMap.get(1)?.pageNumbers).toEqual([]);
        expect(packed.chunkRefMap.get(1)?.textAnchor?.startLine).toBe(42);
        expect(packed.chunkRefMap.get(2)?.textAnchor?.endLine).toBe(3);
    });
});
