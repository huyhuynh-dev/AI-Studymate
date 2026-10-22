import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { randomUUID } from 'node:crypto';

export interface GenerateSummaryOptions {
    documentTexts: Array<{ fileName?: string; text: string }>;
    mode: 'key_takeaways' | 'study_guide' | 'qa_style';
    length: 'short' | 'standard' | 'detailed';
    scope: 'conversation' | 'document' | 'section';
    sectionInfo?: string;
    customInstruction?: string;
}

export interface SummaryBlock {
    id: string;
    type: string;
    props?: Record<string, any>;
    content?: any;
    children?: SummaryBlock[];
}

export interface SummaryResult {
    title: string;
    blocks: SummaryBlock[];
}

@Injectable()
export class GeminiSummaryService {
    private readonly logger = new Logger(GeminiSummaryService.name);
    private genAI: GoogleGenAI | null = null;
    private readonly modelName = 'gemini-3.5-flash-lite';

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (apiKey) {
            this.genAI = new GoogleGenAI({ apiKey });
            this.logger.log(`GeminiSummaryService đã khởi tạo với model [${this.modelName}]`);
        } else {
            this.logger.warn('Chưa cấu hình GEMINI_API_KEY trong file môi trường (.env)');
        }
    }

    private ensureClient(): GoogleGenAI {
        if (!this.genAI) {
            const apiKey = this.configService.get<string>('GEMINI_API_KEY');
            if (!apiKey) {
                throw new Error('GEMINI_API_KEY chưa được cấu hình trong biến môi trường');
            }
            this.genAI = new GoogleGenAI({ apiKey });
        }
        return this.genAI;
    }

    /**
     * Sinh bản tóm tắt mới bằng AI model gemini-3.6-flash
     */
    async generateSummary(options: GenerateSummaryOptions): Promise<SummaryResult> {
        const client = this.ensureClient();

        // 1. Ghép nội dung tài liệu
        const contextText = options.documentTexts
            .map((doc, idx) => {
                const header = doc.fileName ? `=== TÀI LIỆU ${idx + 1}: ${doc.fileName} ===` : `=== TÀI LIỆU ${idx + 1} ===`;
                return `${header}\n${doc.text}\n`;
            })
            .join('\n\n');

        if (!contextText.trim()) {
            throw new Error('Không có nội dung văn bản để thực hiện tóm tắt');
        }

        // 2. Định nghĩa phong cách theo mode
        let styleInstruction = '';
        switch (options.mode) {
            case 'key_takeaways':
                styleInstruction =
                    'PHONG CÁCH: DÀN Ý CỐT LÕI (Key Takeaways)\n' +
                    '- Tập trung vào các gạch đầu dòng ngắn gọn, cô đọng.\n' +
                    '- Làm nổi bật định nghĩa quan trọng, nguyên lý cốt lõi, từ khóa then chốt.\n' +
                    '- Phân loại theo các mục rõ ràng (Heading 2, Heading 3).';
                break;
            case 'study_guide':
                styleInstruction =
                    'PHONG CÁCH: HỒ SƠ ÔN THI CHI TIẾT (Study Guide)\n' +
                    '- Phân tích sâu sắc bản chất vấn đề, diễn giải mạch lạc.\n' +
                    '- Liệt kê công thức, quy trình, các bước giải quyết, mẹo ghi nhớ.\n' +
                    '- Đối chiếu các khái niệm dễ nhầm lẫn, cung cấp ví dụ thực tiễn hoặc bài tập điển hình.';
                break;
            case 'qa_style':
                styleInstruction =
                    'PHONG CÁCH: HỎI & ĐÁP (Q&A Style)\n' +
                    '- Trích xuất các câu hỏi thi mấu chốt thường gặp dưới dạng câu hỏi & câu trả lời súc tích.\n' +
                    '- Mỗi mục gồm: Câu hỏi (Heading hoặc in đậm) và Lời giải thích/Đáp án rõ ràng, kèm giải thích tại sao.';
                break;
        }

        // 3. Định nghĩa độ dài theo length
        let lengthInstruction = '';
        switch (options.length) {
            case 'short':
                lengthInstruction = 'ĐỘ DÀI: NGẮN GỌN (~300 - 600 từ), súc tích nhất có thể, chỉ giữ lại điều cốt tử.';
                break;
            case 'standard':
                lengthInstruction = 'ĐỘ DÀI: TIÊU CHUẨN (~800 - 1500 từ), cân bằng giữa độ sâu và tính súc tích.';
                break;
            case 'detailed':
                lengthInstruction = 'ĐỘ DÀI: CHI TIẾT (~1500 - 2500 từ), bao quát đầy đủ mọi khía cạnh, ví dụ, công thức và phân tích sâu.';
                break;
        }

        let sectionInstruction = '';
        if (options.scope === 'section' && options.sectionInfo) {
            sectionInstruction = `PHẠM VI ĐẶC BIỆT: Người dùng yêu cầu tập trung tóm tắt phần sau: "${options.sectionInfo}". Hãy ưu tiên phân tích kỹ phần này.`;
        }

        let extraInstruction = '';
        if (options.customInstruction?.trim()) {
            extraInstruction = `YÊU CẦU BỔ SUNG CỦA NGƯỜI HỌC: "${options.customInstruction.trim()}"`;
        }

        const systemPrompt =
            `Bạn là Trợ lý Học tập AI cao cấp thuộc nền tảng AI StudyMate.\n` +
            `Nhiệm vụ của bạn là đọc các tài liệu học tập được cung cấp và xây dựng một bản TÓM TẮT HỌC TẬP CHẤT LƯỢNG CAO bằng Tiếng Việt.\n\n` +
            `QUY ĐỊNH BẮT BUỘC VỀ ĐỊNH DẠNG ĐẦU RA:\n` +
            `Bạn PHẢI trả về duy nhất một chuỗi JSON hợp lệ (không kèm Markdown code block \`\`\`json ngoài trừ JSON nguyên bản) có cấu trúc:\n` +
            `{\n` +
            `  "title": "Tiêu đề bản tóm tắt hấp dẫn, ngắn gọn, phù hợp với nội dung",\n` +
            `  "blocks": [\n` +
            `    {\n` +
            `      "type": "heading",\n` +
            `      "props": { "level": 1 },\n` +
            `      "content": [{ "type": "text", "text": "Tiêu đề chính", "styles": {} }]\n` +
            `    },\n` +
            `    {\n` +
            `      "type": "paragraph",\n` +
            `      "props": {},\n` +
            `      "content": [\n` +
            `        { "type": "text", "text": "Đoạn văn mở đầu... ", "styles": {} },\n` +
            `        { "type": "text", "text": "từ khóa quan trọng", "styles": { "bold": true } }\n` +
            `      ]\n` +
            `    },\n` +
            `    {\n` +
            `      "type": "heading",\n` +
            `      "props": { "level": 2 },\n` +
            `      "content": [{ "type": "text", "text": "1. Khái niệm cốt lõi", "styles": {} }]\n` +
            `    },\n` +
            `    {\n` +
            `      "type": "bulletListItem",\n` +
            `      "props": {},\n` +
            `      "content": [{ "type": "text", "text": "Ý chính 1...", "styles": {} }]\n` +
            `    },\n` +
            `    {\n` +
            `      "type": "numberedListItem",\n` +
            `      "props": {},\n` +
            `      "content": [{ "type": "text", "text": "Bước 1...", "styles": {} }]\n` +
            `    }\n` +
            `  ]\n` +
            `}\n\n` +
            `DANH SÁCH TOÀN BỘ CÁC LOẠI BLOCK MÀ BLOCKNOTE HỖ TRỢ:\n` +
            `Bạn hãy chủ động lựa chọn và kết hợp linh hoạt những loại block phù hợp và tối ưu nhất cho bài học (không nhất thiết phải dùng hết, chỉ dùng khi thấy cần thiết):\n` +
            `- "heading": Tiêu đề phân cấp. Props: { "level": 1 | 2 | 3, "isToggleable"?: boolean }\n` +
            `- "paragraph": Đoạn văn diễn giải, mở đầu, tổng kết hoặc giải thích\n` +
            `- "quote": Khối trích dẫn, nguyên lý bất biến, cảnh báo quan trọng hoặc ghi nhớ nhanh\n` +
            `- "bulletListItem": Danh sách gạch đầu dòng các ý chính, tính chất hoặc đặc điểm\n` +
            `- "numberedListItem": Danh sách đánh số thứ tự các bước thực hiện, quy trình hoặc thứ hạng\n` +
            `- "checkListItem": Danh sách việc cần làm, checklist mục tiêu tự ôn luyện. Props: { "checked": false }\n` +
            `- "toggleListItem": Mục có thể thu gọn/mở rộng (toggle), rất hữu ích cho dạng câu hỏi kèm gợi ý ẩn hoặc nội dung chi tiết mở rộng\n` +
            `- "codeBlock": Khối code khi tóm tắt các môn lập trình, thuật toán hoặc câu lệnh. Props: { "language": "javascript" | "python" | "cpp" | "java" | "sql" | "bash" | "html" | ... }, Content: chuỗi code hoặc mảng text\n` +
            `- "table": Bảng biểu đối chiếu, so sánh các khái niệm, bảng công thức hoặc bảng tra cứu. Cấu trúc:\n` +
            `  "content": {\n` +
            `    "type": "tableContent",\n` +
            `    "rows": [\n` +
            `      { "cells": ["Tiêu chí", "Khái niệm A", "Khái niệm B"] },\n` +
            `      { "cells": ["Định nghĩa", "...", "..."] }\n` +
            `    ]\n` +
            `  }\n` +
            `- "image": Khối hình ảnh tham khảo nếu có URL hợp lệ. Props: { "url": "https://...", "caption": "Mô tả ảnh" }\n\n` +
            `ĐỊNH DẠNG NỘI DUNG NỘI DÒNG (Inline Content):\n` +
            `- Văn bản có định dạng: { "type": "text", "text": "...", "styles": { "bold"?: boolean, "italic"?: boolean, "underline"?: boolean, "strike"?: boolean, "code"?: boolean, "textColor"?: string, "backgroundColor"?: string } }\n` +
            `- Đường dẫn liên kết: { "type": "link", "content": "Tên liên kết", "href": "https://..." }\n\n` +
            `${styleInstruction}\n` +
            `${lengthInstruction}\n` +
            `${sectionInstruction}\n` +
            `${extraInstruction}\n\n` +
            `NGUYÊN TẮC THIẾT KẾ BẢN TÓM TẮT:\n` +
            `1. Trình bày khoa học, đẹp mắt, phân tầng logic rõ ràng.\n` +
            `2. Sử dụng table khi cần so sánh/đối chiếu khái niệm; dùng quote khi có định lý/lưu ý sống còn; dùng codeBlock khi có mã nguồn/câu lệnh; dùng toggleListItem khi có phần mở rộng.\n` +
            `3. Bôi đậm các từ khóa quan trọng và dùng Tiếng Việt học thuật chuẩn xác, dễ hiểu.`;

        const userPrompt = `Dưới đây là nội dung tài liệu học tập:\n\n${contextText.slice(0, 100000)}\n\nHãy tạo bản tóm tắt học tập theo đúng chỉ dẫn trên.`;

        try {
            this.logger.log(`Đang gọi Gemini model [${this.modelName}] để sinh tóm tắt (${options.mode}, ${options.length})...`);

            const response = await client.models.generateContent({
                model: this.modelName,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: systemPrompt },
                            { text: userPrompt },
                        ],
                    },
                ],
                config: {
                    responseMimeType: 'application/json',
                },
            });

            const text = response.text || '';
            const parsed = this.parseSummaryJson(text);
            return parsed;
        } catch (error: any) {
            this.logger.error(`Lỗi sinh tóm tắt bằng Gemini (${this.modelName}): ${error.message}`, error.stack);
            throw new Error(`AI Tóm tắt thất bại: ${error.message}`);
        }
    }

    /**
     * Tinh chỉnh bản tóm tắt hiện có theo chỉ dẫn của người học
     */
    async refineSummary(currentBlocks: any[], instruction: string): Promise<SummaryResult> {
        const client = this.ensureClient();

        if (!currentBlocks || !Array.isArray(currentBlocks) || currentBlocks.length === 0) {
            throw new Error('Bản tóm tắt hiện tại không có dữ liệu để tinh chỉnh');
        }

        const systemPrompt =
            `Bạn là Trợ lý Học tập AI cao cấp của nền tảng AI StudyMate.\n` +
            `Người dùng muốn TINH CHỈNH bản tóm tắt học tập hiện tại theo yêu cầu cụ thể.\n\n` +
            `HƯỚNG DẪN:\n` +
            `1. Bạn sẽ nhận được cấu trúc JSON hiện tại của bản tóm tắt (danh sách blocks BlockNote) và CHỈ DẪN của người học.\n` +
            `2. Hãy giữ lại cấu trúc và các nội dung có giá trị của bản tóm tắt cũ, đồng thời cập nhật, bổ sung, rút gọn, hoặc diễn đạt lại các khối theo đúng chỉ dẫn của người học.\n` +
            `3. Trả về DUY NHẤT một chuỗi JSON hợp lệ có định dạng:\n` +
            `{\n` +
            `  "title": "Tiêu đề mới (hoặc giữ nguyên nếu phù hợp)",\n` +
            `  "blocks": [ ...các khối BlockNote đã được tinh chỉnh... ]\n` +
            `}\n\n` +
            `Các loại block BlockNote được hỗ trợ: paragraph, heading, quote, bulletListItem, numberedListItem, checkListItem, toggleListItem, codeBlock, table, image, file.`;

        const userPrompt =
            `CHỈ DẪN CỦA NGƯỜI HỌC: "${instruction}"\n\n` +
            `BẢN TÓM TẮT HIỆN TẠI (JSON BLOCKS):\n${JSON.stringify(currentBlocks, null, 2).slice(0, 50000)}`;

        try {
            this.logger.log(`Đang gọi Gemini model [${this.modelName}] để tinh chỉnh tóm tắt theo chỉ dẫn: "${instruction}"...`);

            const response = await client.models.generateContent({
                model: this.modelName,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: systemPrompt },
                            { text: userPrompt },
                        ],
                    },
                ],
                config: {
                    responseMimeType: 'application/json',
                },
            });

            const text = response.text || '';
            const parsed = this.parseSummaryJson(text);
            return parsed;
        } catch (error: any) {
            this.logger.error(`Lỗi tinh chỉnh tóm tắt bằng Gemini (${this.modelName}): ${error.message}`, error.stack);
            throw new Error(`AI Tinh chỉnh thất bại: ${error.message}`);
        }
    }

    /**
     * Parse và chuẩn hóa JSON trả về từ Gemini thành cấu trúc BlockNote blocks hợp lệ
     */
    private parseSummaryJson(rawText: string): SummaryResult {
        let cleaned = rawText.trim();
        // Xóa markdown code fence nếu có
        if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
        } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/, '');
        }

        try {
            const parsed = JSON.parse(cleaned);
            const title = typeof parsed.title === 'string' && parsed.title.trim()
                ? parsed.title.trim()
                : 'Bản Tóm Tắt Học Tập';

            let blocks: any[] = [];
            if (Array.isArray(parsed.blocks)) {
                blocks = parsed.blocks;
            } else if (Array.isArray(parsed)) {
                blocks = parsed;
            }

            // Chuẩn hóa từng block bảo đảm có id và cấu trúc đúng chuẩn BlockNote
            const normalizedBlocks = this.normalizeBlocks(blocks);

            if (normalizedBlocks.length === 0) {
                // Fallback nếu không có blocks nào
                normalizedBlocks.push({
                    id: randomUUID(),
                    type: 'paragraph',
                    props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
                    content: [{ type: 'text', text: cleaned.slice(0, 500), styles: {} }],
                    children: [],
                });
            }

            return {
                title,
                blocks: normalizedBlocks,
            };
        } catch (err: any) {
            this.logger.warn(`Không parse được JSON từ AI response, tiến hành fallback Markdown -> Blocks: ${err.message}`);
            return this.fallbackMarkdownToBlocks(cleaned);
        }
    }

    /**
     * Chuẩn hóa mảng blocks - Hỗ trợ toàn bộ các loại Block của BlockNote
     */
    private normalizeBlocks(rawBlocks: any[]): SummaryBlock[] {
        const VALID_BLOCK_TYPES = [
            'paragraph',
            'heading',
            'quote',
            'bulletListItem',
            'numberedListItem',
            'checkListItem',
            'toggleListItem',
            'codeBlock',
            'table',
            'image',
            'video',
            'audio',
            'file',
        ];

        return rawBlocks.map((b) => {
            const blockType = VALID_BLOCK_TYPES.includes(b?.type) ? b.type : 'paragraph';
            const blockId = (typeof b?.id === 'string' && b.id.trim()) ? b.id : randomUUID();

            const props: Record<string, any> = {
                ...(typeof b?.props === 'object' && b?.props ? b.props : {}),
            };

            if (blockType === 'heading' && !props.level) {
                props.level = 2;
            }

            // Xử lý nội dung (content) theo từng loại block
            let content: any = undefined;

            if (blockType === 'table') {
                // Table block format trong BlockNote
                if (b?.content && typeof b.content === 'object' && Array.isArray(b.content.rows)) {
                    content = {
                        type: 'tableContent',
                        rows: b.content.rows.map((row: any) => ({
                            cells: Array.isArray(row?.cells)
                                ? row.cells.map((cell: any) => this.normalizeTableCell(cell))
                                : [],
                        })),
                    };
                } else if (Array.isArray(b?.rows)) {
                    content = {
                        type: 'tableContent',
                        rows: b.rows.map((row: any) => ({
                            cells: Array.isArray(row?.cells)
                                ? row.cells.map((cell: any) => this.normalizeTableCell(cell))
                                : [],
                        })),
                    };
                } else {
                    content = {
                        type: 'tableContent',
                        rows: [],
                    };
                }
            } else if (['image', 'video', 'audio', 'file'].includes(blockType)) {
                // Media blocks lưu thông tin trong props (url, caption, name)
                content = undefined;
            } else {
                // Text-based blocks: paragraph, heading, quote, bulletListItem, numberedListItem, checkListItem, toggleListItem, codeBlock
                if (Array.isArray(b?.content)) {
                    content = b.content.map((item: any) => this.normalizeInlineItem(item));
                } else if (typeof b?.content === 'string') {
                    content = [{ type: 'text', text: b.content, styles: {} }];
                } else if (typeof b?.text === 'string') {
                    content = [{ type: 'text', text: b.text, styles: {} }];
                } else {
                    content = [{ type: 'text', text: '', styles: {} }];
                }
            }

            return {
                id: blockId,
                type: blockType,
                props,
                content,
                children: Array.isArray(b?.children) ? this.normalizeBlocks(b.children) : [],
            };
        });
    }

    /**
     * Chuẩn hóa phần tử nội dòng (Inline Item: text hoặc link)
     */
    private normalizeInlineItem(item: any): any {
        if (typeof item === 'string') {
            return { type: 'text', text: item, styles: {} };
        }
        if (item?.type === 'link') {
            return {
                type: 'link',
                content: typeof item.content === 'string'
                    ? [{ type: 'text', text: item.content, styles: {} }]
                    : Array.isArray(item.content)
                        ? item.content.map((c: any) => (typeof c === 'string' ? { type: 'text', text: c, styles: {} } : c))
                        : [{ type: 'text', text: String(item.content || ''), styles: {} }],
                href: item.href || '#',
            };
        }
        return {
            type: 'text',
            text: typeof item?.text === 'string' ? item.text : '',
            styles: typeof item?.styles === 'object' && item.styles ? item.styles : {},
        };
    }

    /**
     * Chuẩn hóa ô bảng (Table Cell)
     */
    private normalizeTableCell(cell: any): any[] {
        if (Array.isArray(cell)) {
            return cell.map((item) => this.normalizeInlineItem(item));
        }
        if (typeof cell === 'string') {
            return [{ type: 'text', text: cell, styles: {} }];
        }
        if (cell && typeof cell === 'object') {
            return [this.normalizeInlineItem(cell)];
        }
        return [{ type: 'text', text: '', styles: {} }];
    }

    /**
     * Fallback chuyển đổi văn bản thô / markdown sang mảng BlockNote blocks
     */
    private fallbackMarkdownToBlocks(text: string): SummaryResult {
        const lines = text.split('\n');
        const blocks: SummaryBlock[] = [];
        let title = 'Bản Tóm Tắt Học Tập';
        let inCodeBlock = false;
        let codeContent = '';
        let codeLang = 'javascript';

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith('```')) {
                if (inCodeBlock) {
                    blocks.push({
                        id: randomUUID(),
                        type: 'codeBlock',
                        props: { language: codeLang },
                        content: [{ type: 'text', text: codeContent.trim(), styles: {} }],
                        children: [],
                    });
                    inCodeBlock = false;
                    codeContent = '';
                } else {
                    inCodeBlock = true;
                    codeLang = trimmed.replace(/^```/, '').trim() || 'javascript';
                    codeContent = '';
                }
                continue;
            }

            if (inCodeBlock) {
                codeContent += line + '\n';
                continue;
            }

            if (!trimmed) continue;

            if (trimmed.startsWith('# ')) {
                title = trimmed.replace(/^#\s+/, '');
                blocks.push({
                    id: randomUUID(),
                    type: 'heading',
                    props: { level: 1 },
                    content: [{ type: 'text', text: title, styles: {} }],
                    children: [],
                });
            } else if (trimmed.startsWith('## ')) {
                blocks.push({
                    id: randomUUID(),
                    type: 'heading',
                    props: { level: 2 },
                    content: [{ type: 'text', text: trimmed.replace(/^##\s+/, ''), styles: {} }],
                    children: [],
                });
            } else if (trimmed.startsWith('### ')) {
                blocks.push({
                    id: randomUUID(),
                    type: 'heading',
                    props: { level: 3 },
                    content: [{ type: 'text', text: trimmed.replace(/^###\s+/, ''), styles: {} }],
                    children: [],
                });
            } else if (trimmed.startsWith('> ')) {
                blocks.push({
                    id: randomUUID(),
                    type: 'quote',
                    props: {},
                    content: [{ type: 'text', text: trimmed.replace(/^>\s+/, ''), styles: {} }],
                    children: [],
                });
            } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                blocks.push({
                    id: randomUUID(),
                    type: 'bulletListItem',
                    props: {},
                    content: [{ type: 'text', text: trimmed.replace(/^[-*]\s+/, ''), styles: {} }],
                    children: [],
                });
            } else if (/^\d+\.\s/.test(trimmed)) {
                blocks.push({
                    id: randomUUID(),
                    type: 'numberedListItem',
                    props: {},
                    content: [{ type: 'text', text: trimmed.replace(/^\d+\.\s+/, ''), styles: {} }],
                    children: [],
                });
            } else {
                blocks.push({
                    id: randomUUID(),
                    type: 'paragraph',
                    props: {},
                    content: [{ type: 'text', text: trimmed, styles: {} }],
                    children: [],
                });
            }
        }

        return {
            title,
            blocks,
        };
    }
}
