import { Layers, Plus, Sparkles } from "lucide-react";
import { Button, cx, FONT_HEADING, SQUIRCLE } from "../ui";

/** A4 / Tầng 3 — Bộ thẻ chưa có flashcard nào (Empty State chuẩn Apple HIG) */
export function CardListEmpty({ onCreate, onAi }: { onCreate: () => void; onAi: () => void }) {
  return (
    <div
      style={SQUIRCLE}
      className="flex flex-col items-center rounded-[24px] border border-dashed border-black/[0.08] dark:border-white/[0.1] px-6 py-14 text-center select-none"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/70 dark:bg-white/[0.04] text-neutral-700 dark:text-neutral-200 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.04)]">
        <Layers className="h-6 w-6 stroke-[1.75]" />
      </div>
      <h3 className={cx(FONT_HEADING, "mt-4 text-lg font-semibold tracking-[-0.015em] text-neutral-900 dark:text-neutral-100")}>
        Chưa có thẻ ghi nhớ
      </h3>
      <p className="mt-1.5 max-w-[320px] text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        Thêm thẻ thủ công hoặc để AI trích xuất tự động từ tài liệu học tập.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={onCreate}>
          Thêm thẻ mới
        </Button>
        <Button variant="secondary" icon={<Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />} onClick={onAi}>
          Tạo bằng AI
        </Button>
      </div>
    </div>
  );
}
