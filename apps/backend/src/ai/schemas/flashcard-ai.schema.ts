/**
 * Zod Schema & Pure Helpers cho tính năng "Tạo Flashcard bằng AI".
 *
 * Kiến trúc 3 tầng:
 * 1) Request Schema: Kiểm tra và chuẩn hóa dữ liệu từ Client gửi lên (hỗ trợ cả 'type_in' và 'typein').
 * 2) LLM Structured Output Schema: Chỉ chứa các trường nội dung bắt buộc, phẳng, tương thích strict mode.
 * 3) Domain Quality Validation & Pure Helpers: Chuẩn hóa lỗi nhỏ của LLM, kiểm định chất lượng từng thẻ,
 *    khử trùng lặp, chia ngân sách ngữ cảnh (water-filling) và chuyển sang HTML an toàn cho TipTap.
 */
import { z } from 'zod';

/**
 * Các giá trị khớp với enum CardTypeEnum trong Prisma ('basic' | 'cloze' | 'type_in').
 */
export const AI_CARD_TYPES = ['basic', 'cloze', 'type_in'] as const;
export type AICardType = (typeof AI_CARD_TYPES)[number];

/**
 * Kiểu nhận từ client: cho phép cả 'typein' (không gạch dưới) rồi chuẩn hóa về 'type_in'.
 */
const ClientCardTypeSchema = z
    .enum(['basic', 'cloze', 'type_in', 'typein'])
    .transform((val): AICardType => (val === 'typein' ? 'type_in' : val));

/* ==========================================================================
 * 1. REQUEST SCHEMA — Dữ liệu client gửi lên
 * ========================================================================== */

export const GenerateFlashcardsRequestSchema = z.object({
    conversationId: z.uuid({ message: 'conversationId phải là UUID hợp lệ' }),
    /** "new": tạo Deck mới (Tab Flashcard) · "deck": thêm thẻ vào Deck hiện có (trong Deck) */
    target: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('new') }),
        z.object({
            kind: z.literal('deck'),
            deckId: z.uuid({ message: 'deckId phải là UUID hợp lệ' }),
        }),
    ]),
    /** "all" = mọi tài liệu của phiên · mảng id = các tài liệu người dùng đã chọn */
    documentIds: z.union([
        z.literal('all'),
        z
            .array(z.uuid({ message: 'documentId phải là UUID hợp lệ' }))
            .min(1, { message: 'Cần chọn ít nhất 1 tài liệu' })
            .max(50, { message: 'Tối đa 50 tài liệu mỗi lần tạo' }),
    ]),
    count: z
        .number()
        .int()
        .min(1, { message: 'Số lượng thẻ tối thiểu là 1' })
        .max(50, { message: 'Số lượng thẻ tối đa là 50' }),
    types: z
        .array(ClientCardTypeSchema)
        .min(1, { message: 'Cần chọn ít nhất 1 loại thẻ' })
        .transform((arr): AICardType[] => [...new Set(arr)]),
    instructions: z.string().trim().max(1000).default(''),
    deckName: z.string().trim().max(255).optional(),
});

export type GenerateFlashcardsRequest = z.infer<
    typeof GenerateFlashcardsRequestSchema
>;

/* ==========================================================================
 * 2. LLM STRUCTURED OUTPUT SCHEMA — Gửi cho Model (QUIZ_AGENT)
 * ========================================================================== */

export const LlmCardSchema = z.object({
    card_type: z
        .enum(AI_CARD_TYPES)
        .describe(
            'basic = question/term on the front, answer on the back. ' +
                'cloze = ONE sentence with hidden key terms. ' +
                'type_in = question with one short exact answer the learner must type.'
        ),
    front_text: z
        .string()
        .describe(
            'basic: the question or term. ' +
                'cloze: one complete sentence with 1-3 blanks written as {{c1::answer}}, {{c2::answer}}. ' +
                'type_in: the question or prompt. ' +
                "Light markup allowed: **bold**, *italic*, lines starting with '- ' or '1. '. No HTML."
        ),
    back_text: z
        .string()
        .describe(
            'basic: concise answer/definition (light markup allowed). ' +
                'cloze: optional short explanation, or an empty string if nothing to add. ' +
                'type_in: ONLY the exact answer, plain text, at most 5 words, no markup.'
        ),
});

export const LlmDeckMetaSchema = z.object({
    name: z
        .string()
        .describe(
            'Short deck title, at most 60 characters, in the language of the documents.'
        ),
    description: z
        .string()
        .describe(
            'One or two sentences on what the deck covers. Empty string if not needed.'
        ),
});

/** Tab Flashcard -> Tạo Deck mới + danh sách thẻ */
export const LlmNewDeckOutputSchema = z.object({
    deck: LlmDeckMetaSchema,
    cards: z.array(LlmCardSchema).describe('The generated flashcards.'),
});

/** Trong một Deck có sẵn -> Chỉ sinh danh sách thẻ bổ sung */
export const LlmMoreCardsOutputSchema = z.object({
    cards: z.array(LlmCardSchema).describe('The generated flashcards.'),
});

export type LlmCard = z.infer<typeof LlmCardSchema>;
export type LlmNewDeckOutput = z.infer<typeof LlmNewDeckOutputSchema>;
export type LlmMoreCardsOutput = z.infer<typeof LlmMoreCardsOutputSchema>;
export type LlmFlashcardOutput = LlmNewDeckOutput | LlmMoreCardsOutput;

/* ==========================================================================
 * 3. PURE HELPERS — Xử lý Cloze, HTML TipTap, Khử trùng & Ngân sách Ngữ cảnh
 * ========================================================================== */

/** Cloze trong output của LLM: {{c1::đáp án}}. Tạo regex mới mỗi lần để tránh lỗi trạng thái lastIndex của cờ /g */
export const clozeRe = (): RegExp => /\{\{c(\d+)::([\s\S]+?)\}\}/g;

/** Đánh số lại chỗ trống theo thứ tự xuất hiện: c3, c7 -> c1, c2 (cùng số = cùng một chỗ trống, giữ nguyên nhóm) */
export function renumberCloze(text: string): string {
    const map = new Map<string, number>();
    return text.replace(clozeRe(), (_m, idx: string, body: string) => {
        if (!map.has(idx)) {
            map.set(idx, map.size + 1);
        }
        return `{{c${map.get(idx)}::${body.trim()}}}`;
    });
}

/** Gỡ cú pháp cloze, giữ lại chữ (dùng khi LLM lỡ chèn cloze vào thẻ basic / type_in hoặc mặt sau) */
export const unwrapCloze = (text: string): string =>
    text.replace(clozeRe(), '$2');

/** Đếm số nhóm chỗ trống cloze phân biệt trong câu */
export const countCloze = (text: string): number =>
    new Set([...text.matchAll(clozeRe())].map((m) => m[1])).size;

/** Escape các ký tự HTML đặc biệt trước khi chuyển đổi markup */
export const escapeHtml = (s: string): string =>
    s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

/**
 * Xử lý inline markup:
 * 1. Escape HTML trước (ngăn chặn LLM chèn thẻ HTML tùy ý / XSS)
 * 2. Chuyển {{cN::...}} thành <span data-cloze="true">...</span> khớp chuẩn TipTap của dự án
 * 3. Chuyển **bold** -> <strong> và *italic* -> <em>
 */
function formatInlineMarkup(s: string, allowCloze = true): string {
    const escaped = escapeHtml(s);
    const withCloze = allowCloze
        ? escaped.replace(clozeRe(), '<span data-cloze="true">$2</span>')
        : escaped.replace(clozeRe(), '$2');

    return withCloze
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?![*\w])/g, '<em>$1</em>');
}

/**
 * Chuyển văn bản của LLM (markup tối giản: **đậm**, *nghiêng*, "- " / "1. " cho danh sách, {{c1::...}})
 * sang HTML khớp 100% allowlist của sanitizeFlashcardHtml & TipTap editor phía frontend:
 * p, br, strong, em, u, ul, ol, li, span[data-cloze="true"].
 */
export function textToRichHtml(text: string, allowCloze = true): string {
    const blocks: Array<{ tag: 'p' | 'ul' | 'ol'; items: string[] }> = [];
    for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
        const line = raw.trim();
        if (!line) continue;

        const m = /^(?:([-*•])|(\d+[.)]))\s+(.*)$/.exec(line);
        const tag = m ? (m[1] ? 'ul' : 'ol') : 'p';
        const html = formatInlineMarkup(m ? m[3] : line, allowCloze);
        const last = blocks[blocks.length - 1];

        if (tag !== 'p' && last?.tag === tag) {
            last.items.push(html);
        } else {
            blocks.push({ tag, items: [html] });
        }
    }

    return blocks
        .map((b) =>
            b.tag === 'p'
                ? `<p>${b.items[0]}</p>`
                : `<${b.tag}>${b.items.map((i) => `<li><p>${i}</p></li>`).join('')}</${b.tag}>`
        )
        .join('');
}

/** HTML / markup -> văn bản thuần một dòng (dùng để so khớp trùng lặp, đo độ dài, chuẩn hóa đáp án type_in) */
export function stripToPlain(s: string): string {
    return s
        .replace(/<\/(p|li)>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(clozeRe(), '$2')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?![*\w])/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Khóa so khớp khử trùng lặp: bỏ dấu câu / hoa thường, giữ chữ có dấu tiếng Việt (Unicode-aware) */
export const dedupeKey = (s: string): string =>
    stripToPlain(s)
        .normalize('NFC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();

/** Tỉ lệ ký tự bị che trong câu cloze (0..1) — dùng để loại thẻ che gần hết câu */
export function clozeCoverage(front: string): number {
    const total = stripToPlain(front).length;
    if (!total) return 0;
    const hidden = [...front.matchAll(clozeRe())].reduce(
        (n, m) => n + stripToPlain(m[2]).length,
        0
    );
    return hidden / total;
}

export interface BudgetDoc {
    id: string;
    name: string;
    text: string;
}

/**
 * Chia ngân sách ký tự cho nhiều tài liệu theo kiểu "water-filling":
 * tài liệu ngắn được giữ nguyên, phần dư dồn cho tài liệu dài -> không tài liệu nào bị "bỏ đói".
 */
export function fitToBudget<T extends BudgetDoc>(
    docs: T[],
    budget: number
): Array<T & { truncated: boolean }> {
    const total = docs.reduce((n, d) => n + d.text.length, 0);
    if (total <= budget) {
        return docs.map((d) => ({ ...d, truncated: false }));
    }

    const alloc = new Map<string, number>();
    let remaining = budget;
    let left = docs.length;

    for (const d of [...docs].sort((a, b) => a.text.length - b.text.length)) {
        const take = Math.min(d.text.length, Math.floor(remaining / left));
        alloc.set(d.id, take);
        remaining -= take;
        left -= 1;
    }

    return docs.map((d) => {
        const take = alloc.get(d.id) ?? 0;
        return {
            ...d,
            text: d.text.slice(0, take),
            truncated: take < d.text.length,
        };
    });
}

/* ==========================================================================
 * 4. DOMAIN VALIDATION & ROW CONVERSION — Kiểm định nghiệp vụ sau khi LLM trả về
 * ========================================================================== */

export const FLASHCARD_AI_LIMITS = {
    front: 2000,
    back: 4000,
    typeInAnswer: 120,
    deckName: 255,
    maxClozeCoverage: 0.7,
} as const;

export const DomainCardSchema = LlmCardSchema.superRefine((c, ctx) => {
    const addIssue = (path: 'front_text' | 'back_text', message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message });

    if (!c.front_text.trim()) {
        addIssue('front_text', 'front_text rỗng');
    }
    if (c.front_text.length > FLASHCARD_AI_LIMITS.front) {
        addIssue(
            'front_text',
            `front_text dài quá ${FLASHCARD_AI_LIMITS.front} ký tự`
        );
    }
    if (c.back_text.length > FLASHCARD_AI_LIMITS.back) {
        addIssue(
            'back_text',
            `back_text dài quá ${FLASHCARD_AI_LIMITS.back} ký tự`
        );
    }

    switch (c.card_type) {
        case 'basic':
            if (!c.back_text.trim()) {
                addIssue('back_text', 'Thẻ basic thiếu mặt sau');
            }
            break;
        case 'type_in':
            if (!c.back_text.trim()) {
                addIssue('back_text', 'Thẻ type_in thiếu đáp án');
            } else if (
                stripToPlain(c.back_text).length >
                FLASHCARD_AI_LIMITS.typeInAnswer
            ) {
                addIssue('back_text', 'Đáp án type_in quá dài để gõ khớp');
            }
            break;
        case 'cloze': {
            const hasBlank = [...c.front_text.matchAll(clozeRe())].some(
                (m) => m[2].trim().length > 0
            );
            if (!hasBlank || countCloze(c.front_text) === 0) {
                addIssue(
                    'front_text',
                    'Thẻ cloze không có chỗ trống {{cN::...}}'
                );
            } else if (
                clozeCoverage(c.front_text) >
                FLASHCARD_AI_LIMITS.maxClozeCoverage
            ) {
                addIssue('front_text', 'Chỗ trống che gần hết câu');
            }
            break;
        }
    }
});

/**
 * Sửa các lỗi nhỏ mà LLM hay mắc trước khi đưa vào kiểm định DomainCardSchema:
 * - cloze: đánh số lại thứ tự c1, c2; gỡ cú pháp cloze thừa ở mặt sau
 * - type_in: gỡ cú pháp cloze thừa ở mặt trước; đưa đáp án mặt sau về văn bản thuần 1 dòng
 * - basic: gỡ cú pháp cloze thừa ở cả 2 mặt
 */
export function normalizeCard(c: LlmCard): LlmCard {
    const front = c.front_text.trim();
    const back = c.back_text.trim();

    switch (c.card_type) {
        case 'cloze':
            return {
                ...c,
                front_text: renumberCloze(front),
                back_text: unwrapCloze(back),
            };
        case 'type_in':
            return {
                ...c,
                front_text: unwrapCloze(front),
                back_text: stripToPlain(back),
            };
        case 'basic':
        default:
            return {
                ...c,
                front_text: unwrapCloze(front),
                back_text: unwrapCloze(back),
            };
    }
}

export interface FlashcardInsertRow {
    card_type: AICardType;
    front_text: string;
    back_text: string;
}

/**
 * Chuyển đổi 1 thẻ đã qua bước chuẩn hóa & kiểm định sang định dạng lưu vào bảng `flashcards`.
 * - Mặt trước thẻ cloze giữ `<span data-cloze="true">...</span>`.
 * - Mặt sau thẻ type_in được bọc `<p>...</p>` (đã escape HTML) để đồng nhất với sanitizeFlashcardHtml & QuizToFlashcardService.
 */
export function toFlashcardRows(c: LlmCard): FlashcardInsertRow[] {
    const isCloze = c.card_type === 'cloze';
    const frontHtml = textToRichHtml(c.front_text, isCloze);

    let backHtml = '';
    if (c.card_type === 'type_in') {
        const plainAnswer = stripToPlain(c.back_text);
        backHtml = plainAnswer ? `<p>${escapeHtml(plainAnswer)}</p>` : '';
    } else {
        backHtml = textToRichHtml(c.back_text, false);
    }

    return [
        {
            card_type: c.card_type,
            front_text: frontHtml,
            back_text: backHtml,
        },
    ];
}
