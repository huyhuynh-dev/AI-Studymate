import type { ReactNode } from "react";
import { cx, SPRING, SQUIRCLE } from "./tokens";

interface Option<T> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface Props<T extends string | number> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}

/** Thanh gạt chuẩn Apple Segmented Control: Track bo 12px, padding 4px → thumb bo 8px (đồng tâm). */
export function SegmentedControl<T extends string | number>({ options, value, onChange, className }: Props<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="tablist"
      style={{ ...SQUIRCLE, gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
      className={cx(
        "relative grid rounded-xl border border-black/[0.05] dark:border-white/[0.07] bg-neutral-100/90 dark:bg-white/[0.05] p-1",
        className
      )}
    >
      <span
        aria-hidden
        style={{ ...SQUIRCLE, width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
        className={cx(
          "absolute inset-y-1 left-1 rounded-lg bg-white dark:bg-[#252A3A] shadow-xs transition-transform duration-300",
          SPRING
        )}
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "relative z-10 flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold font-heading tabular-nums transition-colors duration-200",
              active
                ? "text-neutral-900 dark:text-white"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
