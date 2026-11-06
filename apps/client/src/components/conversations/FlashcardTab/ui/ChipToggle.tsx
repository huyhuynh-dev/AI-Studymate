import { Check } from "lucide-react";
import { cx, SPRING } from "./tokens";

/** Nhóm chip chọn nhiều chuẩn Apple Capsule */
export function ChipToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
}) {
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o.value)}
            className={cx(
              "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all duration-200 active:scale-95",
              SPRING,
              on
                ? "bg-[#4F46E5] text-white shadow-xs shadow-indigo-500/25"
                : "border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/80 dark:bg-white/[0.05] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/[0.1]"
            )}
          >
            {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
