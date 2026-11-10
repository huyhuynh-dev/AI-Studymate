import { Sparkles, Zap } from "lucide-react";
import { GLASS, SQUIRCLE } from "../ui";

/** Cụm thẻ chồng nghiêng + nhãn "SRS x3" + biểu tượng AI chuẩn Apple HIG */
export function DeckStackIllustration() {
  return (
    <div aria-hidden className="relative h-36 w-48">
      <div
        style={SQUIRCLE}
        className="absolute inset-x-5 top-7 h-24 -rotate-12 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 dark:bg-indigo-500/15"
      />
      <div
        style={SQUIRCLE}
        className="absolute inset-x-5 top-6 h-24 rotate-6 rounded-2xl border border-purple-500/20 bg-purple-500/10 dark:bg-purple-500/15"
      />
      <div
        style={SQUIRCLE}
        className={`${GLASS} absolute inset-x-3 top-4 flex h-24 -rotate-2 flex-col justify-center gap-2 rounded-2xl px-6 shadow-md`}
      >
        <span className="h-2.5 w-20 rounded-full bg-indigo-500/30 dark:bg-indigo-400/30" />
        <span className="h-2 w-28 rounded-full bg-neutral-200 dark:bg-white/[0.1]" />
        <span className="h-2 w-16 rounded-full bg-neutral-200 dark:bg-white/[0.1]" />
      </div>
      <span className="tabular-nums absolute -top-1 right-0 inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 shadow-2xs">
        <Zap className="h-3 w-3 fill-current" /> SRS x3
      </span>
      <span className="absolute -bottom-1 left-2 flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-tr from-[#6366F1] to-[#7C3AED] text-white shadow-md shadow-indigo-500/25">
        <Sparkles className="h-4.5 w-4.5 fill-white" />
      </span>
    </div>
  );
}
