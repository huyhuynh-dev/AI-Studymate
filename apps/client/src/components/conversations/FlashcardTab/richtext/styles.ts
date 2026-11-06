/**
 * Class dùng chung cho Editor và RichText → "soạn sao, học vậy" (WYSIWYG).
 * Viết nguyên văn (không nối chuỗi động) để Tailwind quét được.
 */
export const RICH_CONTENT = [
  "[&_p:empty]:min-h-[1.2em] [&_p+p]:mt-[0.45em]",
  "[&_strong]:font-bold [&_em]:italic [&_u]:underline [&_u]:underline-offset-[3px]",
  "[&_ul]:my-1.5 [&_ol]:my-1.5 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:pl-0.5 [&_li]:marker:text-indigo-400 [&_li>p]:m-0",
].join(" ");

/** Thẻ học căn giữa: danh sách vẫn căn trái nhưng nằm giữa khung */
export const ALIGN_CENTER = "text-center [&_ul]:mx-auto [&_ol]:mx-auto [&_ul]:w-fit [&_ol]:w-fit [&_ul]:text-left [&_ol]:text-left";

/** Hình dạng chỗ trống (span[data-cloze]) */
export const CLOZE_CHIP =
  "[&_[data-cloze]]:mx-0.5 [&_[data-cloze]]:rounded-lg [&_[data-cloze]]:px-2 [&_[data-cloze]]:py-0.5 [&_[data-cloze]]:font-semibold [&_[data-cloze]]:box-decoration-clone [&_[data-cloze]]:transition-colors [&_[data-cloze]]:duration-500";

/** Màu chỗ trống theo chế độ — điều khiển bằng thuộc tính data-cloze-mode trên phần tử cha */
export const CLOZE_MODES = [
  "[&[data-cloze-mode=marked]_[data-cloze]]:bg-indigo-100 [&[data-cloze-mode=marked]_[data-cloze]]:text-indigo-600",
  "[&[data-cloze-mode=hidden]_[data-cloze]]:bg-indigo-100 [&[data-cloze-mode=hidden]_[data-cloze]]:text-indigo-600",
  "[&[data-cloze-mode=revealed]_[data-cloze]]:bg-[#6CF8BB]/35 [&[data-cloze-mode=revealed]_[data-cloze]]:font-bold [&[data-cloze-mode=revealed]_[data-cloze]]:text-[#005236]",
].join(" ");

/** Placeholder của Tiptap (class is-editor-empty do extension tự gắn) */
export const EDITOR_PLACEHOLDER =
  "[&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:text-[#777587] [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]";
