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
        className="h-10 w-full cursor-pointer appearance-none rounded-xl border-[1.5px] border-transparent bg-[#EFF4FF]/70 pl-3.5 pr-9 text-[13px] font-medium text-[#0B1C30] outline-none transition-all duration-300 hover:bg-[#EFF4FF] focus:border-indigo-600 focus:bg-white focus:ring-[3px] focus:ring-indigo-600/15"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777587]" />
    </div>
  );
}
