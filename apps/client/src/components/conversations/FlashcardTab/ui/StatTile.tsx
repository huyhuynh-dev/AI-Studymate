import { TONE_TEXT, type Tone } from "../constants";
import { cx, FONT_HEADING, SQUIRCLE } from "./tokens";

export function StatTile({ label, value, tone = "gray", large }: { label: string; value: string | number; tone?: Tone; large?: boolean }) {
  return (
    <div
      style={SQUIRCLE}
      className={cx(
        "rounded-2xl border border-black/[0.04] dark:border-white/[0.06] bg-neutral-100/70 dark:bg-white/[0.04]",
        large ? "px-5 py-6 text-center" : "px-3.5 py-3"
      )}
    >
      <p className={cx(FONT_HEADING, "font-bold tabular-nums", TONE_TEXT[tone], large ? "text-3xl" : "text-xl")}>{value}</p>
      <p className={cx("mt-0.5 font-medium text-neutral-500 dark:text-neutral-400", large ? "text-[13px]" : "text-[12px]")}>{label}</p>
    </div>
  );
}
