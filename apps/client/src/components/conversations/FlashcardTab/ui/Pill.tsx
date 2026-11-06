import type { ReactNode } from "react";
import { TONE_SOFT, type Tone } from "../constants";
import { cx } from "./tokens";

export function Pill({ tone = "gray", icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.02em]", TONE_SOFT[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
