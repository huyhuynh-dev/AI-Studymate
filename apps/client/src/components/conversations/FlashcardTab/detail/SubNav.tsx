import { ChevronLeft } from "lucide-react";
import { cx, FONT_HEADING } from "../ui";

/** Thanh điều hướng phụ chuẩn Apple Navigation Pill: ← Danh sách bộ thẻ / Tên bộ thẻ */
export function SubNav({ deckName, onBack }: { deckName: string; onBack: () => void }) {
  return (
    <nav aria-label="Điều hướng phụ" className="flex items-center gap-2.5 text-xs sm:text-sm">
      <button
        type="button"
        onClick={onBack}
        className={cx(
          FONT_HEADING,
          "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-white/80 dark:bg-white/[0.06] px-3 text-xs font-semibold text-neutral-700 dark:text-neutral-200 shadow-2xs transition-all duration-200 hover:bg-neutral-50 dark:hover:bg-white/[0.1] hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 shrink-0"
        )}
      >
        <ChevronLeft className="h-4 w-4" />
        <span>Danh sách bộ thẻ</span>
      </button>
      <span className="text-neutral-300 dark:text-neutral-600">/</span>
      <span className="line-clamp-1 font-medium text-neutral-600 dark:text-neutral-400">{deckName}</span>
    </nav>
  );
}
