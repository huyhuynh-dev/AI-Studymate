/**
 * NGUỒN SỰ THẬT DUY NHẤT về "HTML nào được phép lưu".
 *
 * Thêm một định dạng mới (vd: highlight) gồm 2 bước:
 *   1. Thêm id vào FormatId + khai báo tags/attrs trong FORMAT_SCHEMA (file này)
 *   2. Thêm entry cùng id trong editor/formats.tsx (TypeScript sẽ báo lỗi nếu quên)
 * Sanitizer, toolbar và extension của Tiptap đều tự cập nhật theo.
 *
 * File này KHÔNG import Tiptap / icon để phần hiển thị thẻ (CardRow, StudyView) không phải kéo theo editor.
 */
export type FormatId = "bold" | "italic" | "underline" | "bulletList" | "orderedList" | "cloze";

export interface FormatSchema {
  tags: string[];
  attrs?: string[];
}

export const FORMAT_SCHEMA: Record<FormatId, FormatSchema> = {
  bold: { tags: ["strong"] },
  italic: { tags: ["em"] },
  underline: { tags: ["u"] },
  bulletList: { tags: ["ul", "li"] },
  orderedList: { tags: ["ol", "li"] },
  cloze: { tags: ["span"], attrs: ["data-cloze"] },
};

/** Luôn được phép, không phụ thuộc định dạng nào */
export const BASE_TAGS = ["p", "br"];

export const ALL_FORMATS = Object.keys(FORMAT_SCHEMA) as FormatId[];

/** Bộ định dạng theo ngữ cảnh — đổi 1 dòng ở đây để bật/tắt cho cả editor lẫn sanitizer */
export const BASIC_FORMATS: FormatId[] = ["bold", "italic", "underline", "bulletList", "orderedList"];
export const CLOZE_FORMATS: FormatId[] = [...BASIC_FORMATS, "cloze"];

/** Nhận diện chuỗi đã là HTML do editor tạo (dữ liệu cũ là text thuần sẽ không khớp) */
export const ROOT_BLOCK_RE = /^\s*<(p|ul|ol|h[1-6]|blockquote|pre)[\s>]/i;

export const CLOZE_SELECTOR = "span[data-cloze]";
