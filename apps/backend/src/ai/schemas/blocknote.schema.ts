import { z } from 'zod';

/**
 * Zod Schema cho toàn bộ Built-in Blocks của BlockNote Editor
 * Tương thích 100% với OpenAI Structured Outputs Strict Mode:
 * - Không sử dụng `oneOf` (dùng `z.union`)
 * - Không sử dụng `.optional()` hay `.default()` (gây thiếu tên trường trong mảng `required` hoặc sinh từ khóa cấm `default`)
 * - Sử dụng `.nullable()` để biểu diễn các trường tùy chọn, đảm bảo mọi property đều nằm trong mảng `required`.
 */

// 1. Cấu hình Inline Styles
export const inlineStylesSchema = z.object({
    bold: z.boolean().nullable().describe('In đậm'),
    italic: z.boolean().nullable().describe('In nghiêng'),
    underline: z.boolean().nullable().describe('Gạch chân'),
    strike: z.boolean().nullable().describe('Gạch ngang chữ'),
    code: z.boolean().nullable().describe('Đoạn mã nội dòng (Lưu ý: Không dùng chung với bold/italic)'),
    textColor: z.string().nullable().describe('Màu chữ (ví dụ: "default", "red", "blue", ...)'),
    backgroundColor: z.string().nullable().describe('Màu nền chữ (ví dụ: "default", "yellow", ...)'),
});

export type InlineStyles = z.infer<typeof inlineStylesSchema>;

// 2. Nội dung Inline: StyledText, Link, InlineMath
export const styledTextSchema = z.object({
    type: z.literal('text'),
    text: z.string().describe('Nội dung văn bản'),
    styles: inlineStylesSchema.nullable().describe('Định dạng phong cách của chữ'),
});

export type StyledText = z.infer<typeof styledTextSchema>;

export const inlineLinkSchema = z.object({
    type: z.literal('link'),
    href: z.string().describe('URL đích của liên kết'),
    content: z.array(styledTextSchema).describe('Văn bản hiển thị của link'),
});

export type InlineLink = z.infer<typeof inlineLinkSchema>;

export const inlineMathSchema = z.object({
    type: z.literal('math'),
    content: z.string().describe('Công thức toán LaTeX nội dòng (ví dụ: e^{i\\pi} + 1 = 0)'),
});

export type InlineMath = z.infer<typeof inlineMathSchema>;

export const inlineContentItemSchema = z.union([
    styledTextSchema,
    inlineLinkSchema,
    inlineMathSchema,
]);

export type InlineContentItem = z.infer<typeof inlineContentItemSchema>;

export const inlineContentSchema = z.array(inlineContentItemSchema);
export type InlineContent = InlineContentItem[];

// 3. Các thuộc tính mặc định (DefaultProps) của BlockNote
export const textAlignmentSchema = z.enum(['left', 'center', 'right', 'justify']);

export const defaultPropsSchema = z.object({
    textColor: z.string().nullable().describe('Màu chữ của block ("default", "blue", "red", ...)'),
    backgroundColor: z.string().nullable().describe('Màu nền của block ("default", "gray", ...)'),
    textAlignment: textAlignmentSchema.nullable().describe('Căn lề văn bản'),
});

// 4. Schema chi tiết cho từng loại Block
// Base type hỗ trợ đệ quy cho children
export type BlockNoteBlock = {
    id?: string | null;
    type: string;
    props?: Record<string, any> | null;
    content?: any;
    children?: BlockNoteBlock[] | null;
};

// Paragraph Block
export const paragraphBlockSchema = z.object({
    id: z.string().nullable().describe('ID duy nhất của block (nếu có)'),
    type: z.literal('paragraph'),
    props: defaultPropsSchema.nullable(),
    content: inlineContentSchema.nullable().describe('Nội dung đoạn văn'),
    children: z.lazy(() => z.array(blockNoteBlockSchema)).nullable().describe('Các block con lồng nhau'),
});

// Heading Block (Level 1..6)
export const headingBlockSchema = z.object({
    id: z.string().nullable(),
    type: z.literal('heading'),
    props: z.object({
        textColor: z.string().nullable(),
        backgroundColor: z.string().nullable(),
        textAlignment: textAlignmentSchema.nullable(),
        level: z.union([
            z.literal(1),
            z.literal(2),
            z.literal(3),
            z.literal(4),
            z.literal(5),
            z.literal(6),
        ]).nullable().describe('Cấp độ heading (1 đến 6)'),
        isToggleable: z.boolean().nullable().describe('Có thể thu gọn/mở rộng không'),
    }).nullable(),
    content: inlineContentSchema.nullable().describe('Tiêu đề'),
    children: z.lazy(() => z.array(blockNoteBlockSchema)).nullable(),
});

// Quote Block
export const quoteBlockSchema = z.object({
    id: z.string().nullable(),
    type: z.literal('quote'),
    props: z.object({
        textColor: z.string().nullable(),
        backgroundColor: z.string().nullable(),
    }).nullable(),
    content: inlineContentSchema.nullable().describe('Nội dung trích dẫn'),
    children: z.lazy(() => z.array(blockNoteBlockSchema)).nullable(),
});

// Bullet List Item Block
export const bulletListItemBlockSchema = z.object({
    id: z.string().nullable(),
    type: z.literal('bulletListItem'),
    props: defaultPropsSchema.nullable(),
    content: inlineContentSchema.nullable().describe('Ý gạch đầu dòng'),
    children: z.lazy(() => z.array(blockNoteBlockSchema)).nullable(),
});

// Numbered List Item Block
export const numberedListItemBlockSchema = z.object({
    id: z.string().nullable(),
    type: z.literal('numberedListItem'),
    props: z.object({
        textColor: z.string().nullable(),
        backgroundColor: z.string().nullable(),
        textAlignment: textAlignmentSchema.nullable(),
        start: z.number().nullable().describe('Số thứ tự bắt đầu'),
    }).nullable(),
    content: inlineContentSchema.nullable().describe('Ý danh sách số'),
    children: z.lazy(() => z.array(blockNoteBlockSchema)).nullable(),
});

// Check List Item Block
export const checkListItemBlockSchema = z.object({
    id: z.string().nullable(),
    type: z.literal('checkListItem'),
    props: z.object({
        textColor: z.string().nullable(),
        backgroundColor: z.string().nullable(),
        textAlignment: textAlignmentSchema.nullable(),
        checked: z.boolean().nullable().describe('Trạng thái đã hoàn thành (checkbox)'),
    }).nullable(),
    content: inlineContentSchema.nullable().describe('Nội dung checklist'),
    children: z.lazy(() => z.array(blockNoteBlockSchema)).nullable(),
});

// Toggle List Item Block
export const toggleListItemBlockSchema = z.object({
    id: z.string().nullable(),
    type: z.literal('toggleListItem'),
    props: defaultPropsSchema.nullable(),
    content: inlineContentSchema.nullable().describe('Nội dung tiêu đề toggle'),
    children: z.lazy(() => z.array(blockNoteBlockSchema)).nullable().describe('Nội dung bên trong toggle'),
});

// Code Block
export const codeBlockSchema = z.object({
    id: z.string().nullable(),
    type: z.literal('codeBlock'),
    props: z.object({
        language: z.string().nullable().describe('Ngôn ngữ lập trình (javascript, python, cpp, sql, bash, ...)'),
    }).nullable(),
    content: z.union([
        z.string(),
        inlineContentSchema,
    ]).nullable().describe('Mã nguồn bên trong block'),
    children: z.lazy(() => z.array(blockNoteBlockSchema)).nullable(),
});

// Divider Block
export const dividerBlockSchema = z.object({
    id: z.string().nullable(),
    type: z.literal('divider'),
    props: z.object({}).nullable(),
    children: z.lazy(() => z.array(blockNoteBlockSchema)).nullable(),
});

// Table Block
export const tableCellSchema = z.union([
    z.string().describe('Chuỗi text đơn giản trong ô'),
    inlineContentSchema.describe('Mảng inline content có định dạng trong ô'),
]);

export const tableBlockSchema = z.object({
    id: z.string().nullable(),
    type: z.literal('table'),
    props: z.object({
        textColor: z.string().nullable(),
    }).nullable(),
    content: z.object({
        type: z.literal('tableContent'),
        columnWidths: z.array(z.number().nullable()).nullable(),
        headerRows: z.number().nullable(),
        headerCols: z.number().nullable(),
        rows: z.array(
            z.object({
                cells: z.array(tableCellSchema).min(1).describe('Danh sách các ô trong hàng'),
            })
        ).min(1).describe('Các hàng dữ liệu của bảng (tối thiểu 1 hàng)'),
    }).describe('Cấu trúc nội dung bảng'),
    children: z.lazy(() => z.array(blockNoteBlockSchema)).nullable(),
});

// Media Blocks: File, Image, Video, Audio
export const fileBlockSchema = z.object({
    id: z.string().nullable(),
    type: z.literal('file'),
    props: z.object({
        url: z.string().describe('URL của file đính kèm'),
        name: z.string().nullable().describe('Tên file'),
        caption: z.string().nullable().describe('Chú thích file'),
        backgroundColor: z.string().nullable(),
    }),
    children: z.lazy(() => z.array(blockNoteBlockSchema)).nullable(),
});

export const imageBlockSchema = z.object({
    id: z.string().nullable(),
    type: z.literal('image'),
    props: z.object({
        url: z.string().describe('URL ảnh tham khảo'),
        caption: z.string().nullable().describe('Mô tả hình ảnh'),
        name: z.string().nullable(),
        showPreview: z.boolean().nullable(),
        previewWidth: z.number().nullable(),
        textAlignment: textAlignmentSchema.nullable(),
        backgroundColor: z.string().nullable(),
    }),
    children: z.lazy(() => z.array(blockNoteBlockSchema)).nullable(),
});

export const videoBlockSchema = z.object({
    id: z.string().nullable(),
    type: z.literal('video'),
    props: z.object({
        url: z.string().describe('URL video bài giảng/minh họa'),
        caption: z.string().nullable(),
        name: z.string().nullable(),
        showPreview: z.boolean().nullable(),
        previewWidth: z.number().nullable(),
        textAlignment: textAlignmentSchema.nullable(),
        backgroundColor: z.string().nullable(),
    }),
    children: z.lazy(() => z.array(blockNoteBlockSchema)).nullable(),
});

export const audioBlockSchema = z.object({
    id: z.string().nullable(),
    type: z.literal('audio'),
    props: z.object({
        url: z.string().describe('URL âm thanh/podcast'),
        caption: z.string().nullable(),
        name: z.string().nullable(),
        showPreview: z.boolean().nullable(),
        backgroundColor: z.string().nullable(),
    }),
    children: z.lazy(() => z.array(blockNoteBlockSchema)).nullable(),
});

// Math Block (LaTeX độc lập)
export const mathBlockSchema = z.object({
    id: z.string().nullable(),
    type: z.literal('mathBlock'),
    props: z.object({}).nullable(),
    content: z.string().describe('Công thức toán LaTeX khối độc lập (ví dụ: a^2 = \\sqrt{b^2 + c^2})'),
    children: z.lazy(() => z.array(blockNoteBlockSchema)).nullable(),
});

// Diagram Block (Mermaid độc lập)
export const diagramBlockSchema = z.object({
    id: z.string().nullable(),
    type: z.literal('diagram'),
    props: z.object({}).nullable(),
    content: z.string().describe('Mã sơ đồ Mermaid (ví dụ: graph TD\\nA --> B)'),
    children: z.lazy(() => z.array(blockNoteBlockSchema)).nullable(),
});

// Hợp nhất toàn bộ các Built-in Blocks thành Union (tương thích OpenAI Strict Mode)
export const blockNoteBlockSchema: z.ZodType<BlockNoteBlock> = z.lazy(() =>
    z.union([
        paragraphBlockSchema,
        headingBlockSchema,
        quoteBlockSchema,
        bulletListItemBlockSchema,
        numberedListItemBlockSchema,
        checkListItemBlockSchema,
        toggleListItemBlockSchema,
        codeBlockSchema,
        dividerBlockSchema,
        tableBlockSchema,
        fileBlockSchema,
        imageBlockSchema,
        videoBlockSchema,
        audioBlockSchema,
        mathBlockSchema,
        diagramBlockSchema,
    ])
);

// 5. Schema đầu ra hoàn chỉnh cho AI Summary
export const summaryOutputSchema = z.object({
    title: z.string().describe('Tiêu đề bản tóm tắt hấp dẫn, ngắn gọn, phù hợp với nội dung bài học'),
    blocks: z.array(blockNoteBlockSchema).describe('Danh sách các khối nội dung theo cấu trúc chuẩn của BlockNote'),
});

export type SummaryOutput = z.infer<typeof summaryOutputSchema>;
