import { describe, expect, it, vi } from 'vitest';
import { CardTypeEnum } from '../generated/prisma/client.js';
import { FlashcardAiManageService } from '../deck-flashcard/flashcard-ai-manage.service.js';
import { FlashcardAiService } from './flashcard-ai.service.js';
import { toFlashcardRows } from './schemas/flashcard-ai.schema.js';

describe('FlashcardAiService & FlashcardAiManageService (Chunk-Grounded)', () => {
    const baseReq = {
        conversationId: '00000000-0000-0000-0000-000000000001',
        target: { kind: 'new' as const },
        documentIds: 'all' as const,
        count: 5,
        types: ['basic' as const, 'cloze' as const],
        instructions: '',
    };

    it('toFlashcardRows attaches source_refs to every split cloze child card', () => {
        const sourceChunkMap = new Map([
            [
                2,
                {
                    documentId: 'doc-1',
                    fileName: 'MangMayTinh.pdf',
                    chunkId: 'chunk-2',
                    chunkIndex: 5,
                    pageNumbers: [12],
                    bboxes: [{ page_no: 12, l: 10, t: 100, r: 200, b: 80 }],
                    headings: ['Chương 2', 'TCP/IP'],
                    snippet: 'Giao thức TCP hoạt động ở tầng Transport.',
                },
            ],
        ]);

        const rows = toFlashcardRows(
            {
                card_type: 'cloze',
                front_text:
                    'Giao thức {{c1::TCP}} hoạt động ở tầng {{c2::Transport}}.',
                back_text: 'Mô hình OSI/TCP-IP',
                source_chunk_index: 2,
            },
            sourceChunkMap
        );

        expect(rows).toHaveLength(2);
        expect(rows[0].source_refs).toEqual([sourceChunkMap.get(2)]);
        expect(rows[1].source_refs).toEqual([sourceChunkMap.get(2)]);
    });

    it('FlashcardAiService resolves source_chunk_index into source_refs and drops invalid chunk references cleanly', async () => {
        const mockAiService = {
            generateObjectForFeature: vi.fn().mockResolvedValue({
                object: {
                    deck: {
                        name: 'Bộ thẻ Hệ điều hành',
                        description: 'Ôn tập Deadlock',
                    },
                    cards: [
                        {
                            card_type: 'basic',
                            front_text: '4 điều kiện Coffman của Deadlock là gì?',
                            back_text: 'Loại trừ lẫn nhau, Giữ và đợi, Không trưng dụng, Đợi vòng tròn.',
                            source_chunk_index: 1,
                        },
                        {
                            card_type: 'basic',
                            front_text: 'Thuật toán Banker do ai đề xuất?',
                            back_text: 'Edsger Dijkstra.',
                            source_chunk_index: 999,
                        },
                    ],
                },
            }),
        };

        const service = new FlashcardAiService(mockAiService as any);
        const result = await service.generateFlashcards({
            req: baseReq,
            documents: [
                {
                    id: 'doc-1',
                    name: 'OS.pdf',
                    text: 'fallback',
                    chunks: [
                        {
                            id: 'chk-1',
                            chunkIndex: 0,
                            content: 'Coffman đề xuất 4 điều kiện cần cho Deadlock.',
                            pageNumbers: [45],
                            headings: ['Chương 3', 'Deadlock'],
                            bboxes: [{ page_no: 45, l: 50, t: 600, r: 450, b: 540 }],
                        },
                    ],
                },
            ],
        });

        expect(mockAiService.generateObjectForFeature).toHaveBeenCalledWith(
            'FLASHCARD_GENERATE',
            expect.objectContaining({
                docs: [
                    expect.objectContaining({
                        id: 'doc-1',
                        text: expect.stringContaining(
                            '[CHUNK #1 | Trang 45 | Mục: Chương 3 > Deadlock]'
                        ),
                    }),
                ],
            })
        );
        expect(result.rows).toHaveLength(2);
        expect(result.rows[0].source_refs).toEqual([
            expect.objectContaining({
                documentId: 'doc-1',
                chunkId: 'chk-1',
                pageNumbers: [45],
                headings: ['Chương 3', 'Deadlock'],
            }),
        ]);
        expect(result.rows[1].source_refs).toBeUndefined();
    });

    it('FlashcardAiManageService loads chunks via DocumentChunksRepoService and persists source_refs', async () => {
        const mockDeckRepo = {
            verifyConversationOwnership: vi.fn().mockResolvedValue(true),
            createDeckWithFlashcards: vi.fn().mockImplementation(async (params) => ({
                deckId: 'deck-new',
                cards: params.rows.map((r: any, idx: number) => ({
                    id: `card-${idx}`,
                    ...r,
                })),
            })),
        };
        const mockDocumentsRepo = {
            getAllDocumentsByConversationId: vi.fn().mockResolvedValue([
                {
                    id: 'doc-1',
                    file_name: 'Slide.pdf',
                    ocr_status: 'done',
                    raw_text: 'Nội dung slide',
                },
            ]),
        };
        const mockChunksRepo = {
            findChunksByDocumentIds: vi.fn().mockResolvedValue([
                {
                    id: 'chk-10',
                    document_id: 'doc-1',
                    chunk_index: 3,
                    content: 'Nội dung từ chunk 3',
                    raw_content: null,
                    page_numbers: [8],
                    headings: ['Mục 2'],
                    bboxes: [{ page_no: 8, l: 10, t: 20, r: 30, b: 10 }],
                },
            ]),
        };
        const mockFlashcardAiService = {
            generateFlashcards: vi.fn().mockResolvedValue({
                deckMeta: { name: 'Deck AI', description: null },
                rows: [
                    {
                        card_type: 'basic',
                        front_text: '<p>Câu hỏi</p>',
                        back_text: '<p>Đáp án</p>',
                        source_refs: [
                            {
                                documentId: 'doc-1',
                                fileName: 'Slide.pdf',
                                chunkId: 'chk-10',
                                chunkIndex: 3,
                                pageNumbers: [8],
                                bboxes: [{ page_no: 8, l: 10, t: 20, r: 30, b: 10 }],
                                headings: ['Mục 2'],
                            },
                        ],
                    },
                ],
                dropped: [],
                docCount: 1,
                truncatedDocs: 0,
            }),
        };

        const manageService = new FlashcardAiManageService(
            mockDeckRepo as any,
            mockDocumentsRepo as any,
            mockChunksRepo as any,
            mockFlashcardAiService as any
        );

        const res = await manageService.generateWithAi('user-1', baseReq);

        expect(mockChunksRepo.findChunksByDocumentIds).toHaveBeenCalledWith(
            ['doc-1'],
            'user-1'
        );
        expect(mockDeckRepo.createDeckWithFlashcards).toHaveBeenCalledWith(
            expect.objectContaining({
                rows: [
                    expect.objectContaining({
                        card_type: CardTypeEnum.basic,
                        source_refs: [
                            expect.objectContaining({
                                chunkId: 'chk-10',
                                pageNumbers: [8],
                            }),
                        ],
                    }),
                ],
            })
        );
        expect(res.cards[0].source_refs).toHaveLength(1);
    });
});
