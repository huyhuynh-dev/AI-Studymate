import { TONE_BAR } from "../constants";
import { cx } from "./tokens";

/** Thanh tiến độ 3 màu: Mới (xanh dương) · Đang học (vàng cam) · Đã ôn tập (xanh lá) */
export function TriProgress({ newCount, learning, review, className }: { newCount: number; learning: number; review: number; className?: string }) {
  const total = newCount + learning + review;
  const parts = [
    ["blue", newCount],
    ["amber", learning],
    ["green", review],
  ] as const;
  return (
    <div
      role="img"
      aria-label={`${newCount} thẻ mới, ${learning} đang học, ${review} đã ôn tập`}
      className={cx("flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-[#E5EEFF]", className)}
    >
      {total > 0 &&
        parts.map(([tone, n]) =>
          n > 0 ? <span key={tone} className={cx("h-full rounded-full transition-all duration-700", TONE_BAR[tone])} style={{ flexGrow: n }} /> : null
        )}
    </div>
  );
}
