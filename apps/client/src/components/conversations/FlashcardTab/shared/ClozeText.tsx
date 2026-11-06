import { RichText, type ClozeMode } from "../richtext";

/** Hiển thị câu điền khuyết ở 3 trạng thái: ẩn [ … ], lộ đáp án (xanh lá), đánh dấu khi soạn thẻ (chàm).
 *  Giữ nguyên API cũ; bên trong dùng RichText nên hiển thị được cả định dạng lẫn dữ liệu {{ }} cũ. */
export function ClozeText({ text, mode, className }: { text: string; mode: ClozeMode; className?: string }) {
  return <RichText html={text} clozeMode={mode} className={className} />;
}
