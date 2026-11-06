import { cx } from "../ui";
import { parseCloze } from "../utils/cloze";

type Mode = "hidden" | "revealed" | "marked";

/** Hiển thị câu điền khuyết ở 3 trạng thái: ẩn [ … ], lộ đáp án (xanh lá), đánh dấu khi soạn thẻ (chàm) */
export function ClozeText({ text, mode, className }: { text: string; mode: Mode; className?: string }) {
  return (
    <span className={cx("whitespace-pre-wrap", className)}>
      {parseCloze(text).map((seg, i) =>
        seg.kind === "text" ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <span
            key={i}
            className={cx(
              "mx-0.5 inline-block rounded-lg px-2.5 py-0.5 align-baseline font-semibold transition-all duration-500",
              mode === "revealed" ? "bg-[#6CF8BB]/35 font-bold text-[#005236]" : "bg-indigo-100 text-indigo-600"
            )}
          >
            {mode === "hidden" ? "[ … ]" : seg.value}
          </span>
        )
      )}
    </span>
  );
}
