import { Sparkles, Zap } from "lucide-react";
import { GLASS, SQUIRCLE } from "../ui";

/** Cụm thẻ chồng nghiêng + nhãn "SRS x3" + biểu tượng AI */
export function DeckStackIllustration() {
  return (
    <div aria-hidden className="relative h-40 w-52">
      <div style={SQUIRCLE} className="absolute inset-x-6 top-8 h-28 -rotate-12 rounded-3xl bg-indigo-200/60" />
      <div style={SQUIRCLE} className="absolute inset-x-6 top-7 h-28 rotate-6 rounded-3xl bg-[#E3D5FF]/80" />
      <div
        style={SQUIRCLE}
        className={`${GLASS} absolute inset-x-4 top-5 flex h-28 -rotate-2 flex-col justify-center gap-2.5 rounded-3xl bg-white/90 px-7 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_16px_32px_-10px_rgba(79,70,229,0.25)]`}
      >
        <span className="h-2.5 w-24 rounded-full bg-indigo-200" />
        <span className="h-2 w-32 rounded-full bg-[#E5EEFF]" />
        <span className="h-2 w-20 rounded-full bg-[#E5EEFF]" />
      </div>
      <span className="absolute -top-1 right-0 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 shadow-sm">
        <Zap className="h-3 w-3 fill-current" /> SRS x3
      </span>
      <span className="absolute -bottom-1 left-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#6CF8BB] text-[#005236] shadow-[0_8px_16px_-4px_rgba(0,108,73,0.35)]">
        <Sparkles className="h-5 w-5" />
      </span>
    </div>
  );
}
