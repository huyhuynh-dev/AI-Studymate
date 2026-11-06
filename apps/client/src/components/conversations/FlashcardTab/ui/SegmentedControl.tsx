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

/** Thanh gạt: nền trắng trượt theo spring. Track bo 12px, padding 4px → thumb bo 8px (đồng tâm). */
export function SegmentedControl<T extends string | number>({ options, value, onChange, className }: Props<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="tablist"
      style={{ ...SQUIRCLE, gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
      className={cx("relative grid rounded-xl bg-[#E5EEFF]/70 p-1", className)}
    >
      <span
        aria-hidden
        style={{ ...SQUIRCLE, width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
        className={cx(
          "absolute inset-y-1 left-1 rounded-lg bg-white shadow-[inset_0_1px_0_rgba(255,255,255,1),0_2px_8px_-2px_rgba(11,28,48,0.14)] transition-transform duration-500",
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
              "relative z-10 flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors duration-300",
              active ? "text-[#0B1C30]" : "text-[#464555]/80 hover:text-[#0B1C30]"
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
