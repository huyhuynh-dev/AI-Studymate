import { ChevronDown } from "lucide-react";
import { cx, SQUIRCLE } from "./tokens";

interface SelectProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}

export function Select<T extends string>({ value, onChange, options, label, className }: SelectProps<T>) {
  return (
    <div className={cx("relative", className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={SQUIRCLE}
        className="h-9 w-full cursor-pointer appearance-none rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/80 dark:bg-[#161922] pl-3.5 pr-8 text-[13px] font-medium text-neutral-800 dark:text-neutral-200 outline-none transition-all duration-200 hover:bg-neutral-100 dark:hover:bg-[#1B1F2A] focus:border-indigo-500 focus:bg-white dark:focus:bg-[#161922] focus:ring-3 focus:ring-indigo-500/15"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-white dark:bg-[#161922] text-neutral-900 dark:text-white">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
    </div>
  );
}
