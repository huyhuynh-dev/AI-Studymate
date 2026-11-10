import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SummaryService } from './summary.service.js';
import { summaryOutputSchema } from './schemas/blocknote.schema.js';

describe('SummaryService & BlockNote Schema', () => {
    let service: SummaryService;
    let aiService: any;

    beforeEach(() => {
        aiService = {
            generateObjectForFeature: vi.fn(),
            generateObjectForTask: vi.fn(),
        };
        service = new SummaryService(aiService);
    });

    describe('summaryOutputSchema (Zod Strict Mode Compliant)', () => {
        it('nên parse thành công cấu trúc tóm tắt chứa các built-in blocks với các trường nullable', () => {
            const sampleData = {
                title: 'Tóm tắt Kiến trúc Máy tính',
                blocks: [
                    {
                        id: null,
                        type: 'heading',
                        props: { level: 1, isToggleable: false, textColor: null, backgroundColor: null, textAlignment: null },
                        content: [{ type: 'text', text: '1. Khái niệm cơ bản', styles: { bold: true, italic: null, underline: null, strike: null, code: null, textColor: null, backgroundColor: null } }],
                        children: null,
                    },
                    {
                        id: null,
                        type: 'paragraph',
                        props: null,
                        content: [
                            { type: 'text', text: 'Kiến trúc von Neumann bao gồm ', styles: null },
                            { type: 'text', text: 'CPU và Bộ nhớ', styles: { bold: true, italic: true, underline: null, strike: null, code: null, textColor: null, backgroundColor: null } },
                            { type: 'link', href: 'https://example.com', content: [{ type: 'text', text: 'Xem thêm', styles: null }] },
                        ],
                        children: null,
                    },
                    {
                        id: null,
                        type: 'bulletListItem',
                        props: null,
                        content: [{ type: 'text', text: 'ALU xử lý số học', styles: null }],
                        children: [
                            {
                                id: null,
                                type: 'bulletListItem',
                                props: null,
                                content: [{ type: 'text', text: 'Thực hiện phép tính AND, OR, ADD', styles: null }],
                                children: null,
                            },
                        ],
                    },
                    {
                        id: null,
                        type: 'checkListItem',
                        props: { checked: true, textColor: null, backgroundColor: null, textAlignment: null },
                        content: [{ type: 'text', text: 'Đã ôn tập thanh ghi', styles: null }],
                        children: null,
                    },
                    {
                        id: null,
                        type: 'toggleListItem',
                        props: null,
                        content: [{ type: 'text', text: 'Câu hỏi gợi ý', styles: null }],
                        children: [
                            {
                                id: null,
                                type: 'paragraph',
                                props: null,
                                content: [{ type: 'text', text: 'Gợi ý đáp án ẩn bên trong', styles: null }],
                                children: null,
                            },
                        ],
                    },
                    {
                        id: null,
                        type: 'codeBlock',
                        props: { language: 'python' },
                        content: 'print("Hello Architecture")',
                        children: null,
                    },
                    {
                        id: null,
                        type: 'table',
                        props: null,
                        content: {
                            type: 'tableContent',
                            columnWidths: null,
                            headerRows: null,
                            headerCols: null,
                            rows: [
                                { cells: ['Tiêu chí', 'RISC', 'CISC'] },
                                { cells: ['Tập lệnh', 'Đơn giản', 'Phức tạp'] },
                            ],
                        },
                        children: null,
                    },
                    {
                        id: null,
                        type: 'mathBlock',
                        props: null,
                        content: 'E = mc^2',
                        children: null,
                    },
                    {
                        id: null,
                        type: 'diagram',
                        props: null,
                        content: 'graph TD\nA --> B',
                        children: null,
                    },
                    {
                        id: null,
                        type: 'divider',
                        props: null,
                        children: null,
                    },
                ],
            };

            const parsed = summaryOutputSchema.safeParse(sampleData);
            expect(parsed.success).toBe(true);
            if (parsed.success) {
                expect(parsed.data.title).toBe('Tóm tắt Kiến trúc Máy tính');
                expect(parsed.data.blocks.length).toBe(10);
            }
        });
    });

    describe('generateSummary', () => {
        it('nên gọi aiService.generateObjectForFeature với đúng schema và chuẩn hóa triệt để giá trị null', async () => {
            aiService.generateObjectForFeature.mockResolvedValue({
                object: {
                    title: 'Bản Tóm Tắt Tự Động',
                    blocks: [
                        {
                            id: null,
                            type: 'heading',
                            props: { level: 2, textColor: null, backgroundColor: null, textAlignment: null, isToggleable: null },
                            content: [{ type: 'text', text: 'Mục 1', styles: null }],
                            children: null,
                        },
                        {
                            id: null,
                            type: 'paragraph',
                            props: null,
                            content: [
                                // Kiểm tra quy tắc code: nếu có code: true và bold: true, sẽ được chuẩn hóa
                                { type: 'text', text: 'console.log', styles: { code: true, bold: true, italic: null, underline: null, strike: null, textColor: null, backgroundColor: null } },
                            ],
                            children: null,
                        },
                        {
                            id: null,
                            type: 'table',
                            props: null,
                            content: {
                                type: 'tableContent',
                                columnWidths: null,
                                headerRows: null,
                                headerCols: null,
                                rows: [
                                    { cells: ['Cột 1', 'Cột 2'] },
                                ],
                            },
                            children: null,
                        },
                        {
                            id: null,
                            type: 'mathBlock',
                            props: null,
                            content: 'E = mc^2',
                            children: null,
                        },
                    ],
                },
            });

            const result = await service.generateSummary({
                documentTexts: [{ fileName: 'bai1.txt', text: 'Nội dung bài học kiến trúc hệ điều hành' }],
                mode: 'key_takeaways',
                length: 'standard',
                scope: 'document',
            });

            expect(aiService.generateObjectForFeature).toHaveBeenCalledWith(
                'SUMMARIZE_GENERATE',
                expect.objectContaining({
                    mode: 'key_takeaways',
                    length: 'standard',
                }),
                expect.objectContaining({
                    schema: summaryOutputSchema,
                }),
            );

            expect(result.title).toBe('Bản Tóm Tắt Tự Động');
            expect(result.blocks.length).toBe(4);

            // 1. Kiểm tra tự động sinh ID cho mỗi block thay cho null
            expect(result.blocks[0].id).toBeTruthy();
            expect(result.blocks[1].id).toBeTruthy();
            expect(result.blocks[2].id).toBeTruthy();
            expect(result.blocks[3].id).toBeTruthy();

            // 2. Kiểm tra chuẩn hóa props: loại bỏ các key có giá trị null
            expect(result.blocks[0].props).toEqual({ level: 2 });

            // 3. Kiểm tra chuẩn hóa ProseMirror code mark: loại bỏ bold khi đã có code
            expect(result.blocks[1].content[0].styles).toEqual({ code: true });

            // 4. Kiểm tra chuẩn hóa table cells sang mảng inline content
            const tableContent = result.blocks[2].content;
            expect(tableContent.rows[0].cells[0]).toEqual([
                { type: 'text', text: 'Cột 1', styles: {} },
            ]);

            // 5. Kiểm tra giữ nguyên mathBlock độc lập và chuẩn hóa content
            expect(result.blocks[3].type).toBe('mathBlock');
            expect(result.blocks[3].content).toEqual([{ type: 'text', text: 'E = mc^2', styles: {} }]);
        });
    });

    describe('refineSummary', () => {
        it('nên tinh chỉnh bản tóm tắt và chuẩn hóa kết quả', async () => {
            aiService.generateObjectForFeature.mockResolvedValue({
                object: {
                    title: 'Bản Tóm Tắt Đã Tinh Chỉnh',
                    blocks: [
                        {
                            id: null,
                            type: 'paragraph',
                            props: null,
                            content: [{ type: 'text', text: 'Nội dung đã được rút gọn', styles: null }],
                            children: null,
                        },
                    ],
                },
            });

            const currentBlocks = [
                {
                    id: '1',
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Nội dung cũ' }],
                },
            ];

            const result = await service.refineSummary(currentBlocks, 'Rút gọn lại bài học');

            expect(result.title).toBe('Bản Tóm Tắt Đã Tinh Chỉnh');
            expect(result.blocks[0].id).toBeTruthy();
            expect(result.blocks[0].content[0].text).toBe('Nội dung đã được rút gọn');
        });
    });
});
