import { RATING_META, RATING_ORDER, TONE_SOFT } from "../constants";
import type { Flashcard, Rating } from "../types";
import { cx, FONT_HEADING, SPRING, SQUIRCLE } from "../ui";
import { previewInterval } from "../utils/srs";

/** B3 / Bước 2 — 4 nút đánh giá mức độ nhớ chuẩn Apple HIG */
export function RatingBar({ card, onRate }: { card: Flashcard; onRate: (r: Rating) => void }) {
  return (
    <div className="grid w-full max-w-2xl grid-cols-4 gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200 sm:gap-3">
      {RATING_ORDER.map((r) => {
        const m = RATING_META[r];
        return (
          <button
            key={r}
            type="button"
            onClick={() => onRate(r)}
            style={SQUIRCLE}
            className={cx(
              "flex cursor-pointer flex-col items-center gap-0.5 rounded-2xl px-2 py-3 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40",
              SPRING,
              TONE_SOFT[m.tone]
            )}
          >
            <span className="tabular-nums text-[11px] font-medium opacity-75">{previewInterval(card, r)}</span>
            <span className={cx(FONT_HEADING, "text-sm sm:text-[15px] font-bold")}>{m.label}</span>
            <kbd className="mt-0.5 hidden rounded border border-current/20 bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.2 font-sans text-[10px] font-semibold opacity-65 sm:inline-block">
              {m.key}
            </kbd>
          </button>
        );
      })}
    </div>
  );
}
