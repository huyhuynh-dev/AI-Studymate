import { Check } from "lucide-react";
import { cx, SPRING } from "./tokens";

/** Nhóm chip chọn nhiều */
export function ChipToggleGroup<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void }) {
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
              "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-all duration-300 active:scale-95",
              SPRING,
              on ? "bg-indigo-600 text-white shadow-[0_4px_12px_-2px_rgba(79,70,229,0.4)]" : "bg-[#EFF4FF] text-[#464555] hover:bg-[#E5EEFF]"
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
