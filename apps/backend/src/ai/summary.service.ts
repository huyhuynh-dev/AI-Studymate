import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AiService } from './ai.service.js';
import {
    summaryOutputSchema,
    type SummaryOutput,
} from './schemas/blocknote.schema.js';

export interface GenerateSummaryOptions {
    documentTexts: Array<{ fileName?: string; text: string }>;
    mode: 'key_takeaways' | 'study_guide' | 'qa_style';
    length: 'short' | 'standard' | 'detailed';
    scope: 'conversation' | 'document' | 'section';
    sectionInfo?: string;
    customInstruction?: string;
    modelName?: string;
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
export class SummaryService {
    private readonly logger = new Logger(SummaryService.name);

    constructor(private readonly aiService: AiService) { }

    /**
     * Sinh bản tóm tắt mới bằng AI với Structured Output (Zod Schema)
     */
    async generateSummary(options: GenerateSummaryOptions): Promise<SummaryResult> {
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
            `Nhiệm vụ của bạn là đọc các tài liệu học tập được cung cấp và xây dựng một bản TÓM TẮT HỌC TẬP CHẤT LƯỢNG CAO bằng Tiếng Việt theo đúng cấu trúc BlockNote đã định nghĩa.\n\n` +
            `DANH SÁCH CÁC LOẠI BLOCK MÀ BẠN CÓ THỂ SỬ DỤNG:\n` +
            `- "heading": Tiêu đề phân cấp (level: 1 | 2 | 3 | 4 | 5 | 6, isToggleable?: boolean).\n` +
            `- "paragraph": Đoạn văn diễn giải, mở đầu, tổng kết hoặc giải thích.\n` +
            `- "quote": Khối trích dẫn, nguyên lý bất biến, cảnh báo quan trọng hoặc ghi nhớ nhanh.\n` +
            `- "bulletListItem": Danh sách gạch đầu dòng các ý chính, tính chất hoặc đặc điểm.\n` +
            `- "numberedListItem": Danh sách đánh số thứ tự các bước thực hiện, quy trình hoặc thứ hạng (start?: number).\n` +
            `- "checkListItem": Danh sách việc cần làm, checklist mục tiêu tự ôn luyện (checked: boolean).\n` +
            `- "toggleListItem": Mục có thể thu gọn/mở rộng (toggle) chứa các block con bên trong children.\n` +
            `- "codeBlock": Khối code khi tóm tắt các môn lập trình, thuật toán hoặc câu lệnh (language: string).\n` +
            `- "table": Bảng biểu đối chiếu, so sánh các khái niệm, bảng công thức hoặc bảng tra cứu (bắt buộc có ít nhất 1 hàng dữ liệu).\n` +
            `- "divider": Khối đường kẻ ngang phân tách các phần lớn.\n` +
            `- "mathBlock": Công thức toán học LaTeX độc lập.\n` +
            `- "diagram": Sơ đồ/lưu đồ giải thuật Mermaid độc lập.\n` +
            `- "image": Khối hình ảnh tham khảo nếu trong tài liệu có URL hợp lệ.\n\n` +
            `QUY TẮC ĐỊNH DẠNG NỘI DÒNG (Inline Content):\n` +
            `- Văn bản định dạng: { "type": "text", "text": "...", "styles": { "bold"?: boolean, "italic"?: boolean, "code"?: boolean, ... } }\n` +
            `- QUY TẮC CODE: Nếu "code": true thì TUYỆT ĐỐI KHÔNG ĐƯỢC kèm theo bất kỳ style nào khác (bold, italic, underline, v.v.).\n` +
            `- Đường dẫn: { "type": "link", "content": [{ "type": "text", "text": "..." }], "href": "https://..." }\n` +
            `- Công thức toán nội dòng: { "type": "math", "content": "..." }\n\n` +
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
            this.logger.log(
                `Đang gọi model ${options.modelName || 'SUMMARIZE'} với Structured Output (${options.mode}, ${options.length})...`,
            );

            const { object } = await this.aiService.generateObjectForTask<SummaryOutput>(
                'SUMMARIZE',
                {
                    schema: summaryOutputSchema,
                    system: systemPrompt,
                    prompt: userPrompt,
                    temperature: 0.2,
                    ...(options.modelName ? { modelName: options.modelName } : {}),
                },
            );

            return this.ensureBlockNoteCompatibility(object.blocks, object.title);
        } catch (error: any) {
            this.logger.error(`Lỗi sinh tóm tắt: ${error.message}`, error.stack);
            throw new Error(`AI Tóm tắt thất bại: ${error.message}`);
        }
    }

    /**
     * Tinh chỉnh bản tóm tắt hiện có theo chỉ dẫn của người học với Structured Output
     */
    async refineSummary(currentBlocks: any[], instruction: string): Promise<SummaryResult> {
        if (!currentBlocks || !Array.isArray(currentBlocks) || currentBlocks.length === 0) {
            throw new Error('Bản tóm tắt hiện tại không có dữ liệu để tinh chỉnh');
        }

        const systemPrompt =
            `Bạn là Trợ lý Học tập AI cao cấp của nền tảng AI StudyMate.\n` +
            `Người dùng muốn TINH CHỈNH bản tóm tắt học tập hiện tại theo yêu cầu cụ thể.\n\n` +
            `HƯỚNG DẪN:\n` +
            `1. Bạn sẽ nhận được cấu trúc JSON hiện tại của bản tóm tắt (danh sách blocks BlockNote) và CHỈ DẪN của người học.\n` +
            `2. Hãy giữ lại cấu trúc và các nội dung có giá trị của bản tóm tắt cũ, đồng thời cập nhật, bổ sung, rút gọn, hoặc diễn đạt lại các khối theo đúng chỉ dẫn của người học.\n` +
            `3. Tuân thủ định dạng BlockNote chuẩn đã được định nghĩa qua schema.`;

        const userPrompt =
            `CHỈ DẪN CỦA NGƯỜI HỌC: "${instruction}"\n\n` +
            `BẢN TÓM TẮT HIỆN TẠI (JSON BLOCKS):\n${JSON.stringify(currentBlocks, null, 2).slice(0, 50000)}`;

        try {
            this.logger.log(`Đang gọi model SUMMARIZE để tinh chỉnh tóm tắt theo chỉ dẫn: "${instruction}"...`);

            const { object } = await this.aiService.generateObjectForTask<SummaryOutput>(
                'SUMMARIZE',
                {
                    schema: summaryOutputSchema,
                    system: systemPrompt,
                    prompt: userPrompt,
                    temperature: 0.2,
                },
            );

            return this.ensureBlockNoteCompatibility(object.blocks, object.title);
        } catch (error: any) {
            this.logger.error(`Lỗi tinh chỉnh tóm tắt: ${error.message}`, error.stack);
            throw new Error(`AI Tinh chỉnh thất bại: ${error.message}`);
        }
    }

    /**
     * Chuẩn hóa và bảo đảm tính tương thích với BlockNote Editor (gọn nhẹ)
     * - Tự động bổ sung id duy nhất (UUID) cho bất kỳ block nào chưa có
     * - Loại bỏ các giá trị null phát sinh từ Strict Mode schema
     * - Xử lý quy tắc ProseMirror code mark: loại bỏ các style khác nếu code: true
     * - Chuẩn hóa ô bảng (cells) sang mảng inline content nếu nhận được chuỗi text đơn giản
     * - Đệ quy xử lý các block con trong children
     * - Cung cấp fallback paragraph mặc định nếu danh sách blocks rỗng
     */
    private ensureBlockNoteCompatibility(
        rawBlocks: any[],
        title?: string,
    ): SummaryResult {
        const cleanTitle = (typeof title === 'string' && title.trim())
            ? title.trim()
            : 'Bản Tóm Tắt Học Tập';

        const safeBlocks = Array.isArray(rawBlocks) ? rawBlocks : [];
        const validatedBlocks = this.sanitizeBlockList(safeBlocks);

        if (validatedBlocks.length === 0) {
            validatedBlocks.push({
                id: randomUUID(),
                type: 'paragraph',
                props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
                content: [{ type: 'text', text: 'Bản tóm tắt đang được xử lý hoặc nội dung trống.', styles: {} }],
                children: [],
            });
        }

        return {
            title: cleanTitle,
            blocks: validatedBlocks,
        };
    }

    /**
     * Duyệt và chuẩn hóa mảng blocks theo quy chuẩn BlockNote
     */
    private sanitizeBlockList(blocks: any[]): SummaryBlock[] {
        return blocks.map((b) => {
            const blockId = (typeof b?.id === 'string' && b.id.trim()) ? b.id : randomUUID();
            const blockType = typeof b?.type === 'string' ? b.type : 'paragraph';

            // Xóa các props có giá trị null hoặc undefined
            const rawProps = (typeof b?.props === 'object' && b?.props) ? b.props : {};
            const props: Record<string, any> = {};
            for (const [k, v] of Object.entries(rawProps)) {
                if (v !== null && v !== undefined) {
                    props[k] = v;
                }
            }

            if (blockType === 'heading' && !props.level) {
                props.level = 2;
            }

            // Giữ nguyên các loại block chuẩn và extension (mathBlock, diagram, codeBlock, table, ...)
            let finalType = blockType;

            let content: any = undefined;

            if (finalType === 'table') {
                const rawRows = b?.content?.rows || b?.rows || [];
                if (Array.isArray(rawRows) && rawRows.length > 0) {
                    content = {
                        type: 'tableContent',
                        rows: rawRows.map((row: any) => ({
                            cells: Array.isArray(row?.cells)
                                ? row.cells.map((cell: any) => this.sanitizeTableCell(cell))
                                : [],
                        })),
                    };
                } else {
                    // Bảng rỗng không thể render trong BlockNote -> chuyển thành paragraph
                    finalType = 'paragraph';
                    content = [{ type: 'text', text: '', styles: {} }];
                }
            } else if (['divider', 'file', 'image', 'video', 'audio'].includes(finalType)) {
                content = undefined;
            } else if (['codeBlock', 'mathBlock', 'diagram'].includes(finalType)) {
                if (typeof b?.content === 'string') {
                    content = [{ type: 'text', text: b.content, styles: {} }];
                } else if (Array.isArray(b?.content)) {
                    content = b.content.map((item: any) => this.sanitizeInlineItem(item));
                } else {
                    content = [{ type: 'text', text: '', styles: {} }];
                }
            } else {
                // paragraph, heading, quote, bulletListItem, numberedListItem, checkListItem, toggleListItem
                if (Array.isArray(b?.content)) {
                    content = b.content.map((item: any) => this.sanitizeInlineItem(item));
                } else if (typeof b?.content === 'string') {
                    content = [{ type: 'text', text: b.content, styles: {} }];
                } else {
                    content = [{ type: 'text', text: '', styles: {} }];
                }
            }

            const children = Array.isArray(b?.children) && b.children.length > 0
                ? this.sanitizeBlockList(b.children)
                : [];

            return {
                id: blockId,
                type: finalType,
                props,
                content,
                children,
            };
        });
    }

    /**
     * Chuẩn hóa phần tử nội dòng (Inline Item: text, link)
     */
    private sanitizeInlineItem(item: any): any {
        if (!item || typeof item !== 'object') {
            return { type: 'text', text: typeof item === 'string' ? item : '', styles: {} };
        }
        if (item?.type === 'link') {
            const rawContent = item.content;
            return {
                type: 'link',
                href: typeof item.href === 'string' ? item.href : '#',
                content: Array.isArray(rawContent)
                    ? rawContent.map((c: any) => this.sanitizeInlineItem(c))
                    : [{ type: 'text', text: String(rawContent || ''), styles: {} }],
            };
        }
        if (item?.type === 'math') {
            return {
                type: 'math',
                props: {},
                content: typeof item.content === 'string'
                    ? item.content
                    : (typeof item.text === 'string' ? item.text : ''),
            };
        }

        const rawStyles: Record<string, any> = (typeof item?.styles === 'object' && item.styles)
            ? item.styles
            : {};

        const styles: Record<string, any> = {};
        for (const [k, v] of Object.entries(rawStyles)) {
            if (v !== null && v !== undefined && v !== false) {
                styles[k] = v;
            }
        }

        // Quy tắc ProseMirror: code không đi cùng các styles khác (bold, italic, strike, underline)
        if (styles.code) {
            return {
                type: 'text',
                text: typeof item?.text === 'string' ? item.text : '',
                styles: { code: true },
            };
        }

        return {
            type: 'text',
            text: typeof item?.text === 'string' ? item.text : '',
            styles,
        };
    }

    /**
     * Chuẩn hóa ô bảng (Table Cell)
     */
    private sanitizeTableCell(cell: any): any[] {
        if (Array.isArray(cell)) {
            return cell.map((item) => this.sanitizeInlineItem(item));
        }
        if (typeof cell === 'string') {
            return [{ type: 'text', text: cell, styles: {} }];
        }
        if (cell && typeof cell === 'object') {
            if (cell.type === 'tableCell') {
                return Array.isArray(cell.content)
                    ? cell.content.map((item: any) => this.sanitizeInlineItem(item))
                    : [{ type: 'text', text: '', styles: {} }];
            }
            return [this.sanitizeInlineItem(cell)];
        }
        return [{ type: 'text', text: '', styles: {} }];
    }
}
