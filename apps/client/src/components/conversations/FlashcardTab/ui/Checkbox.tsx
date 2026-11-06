import { Check } from "lucide-react";

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300">
      <span className="relative flex h-[18px] w-[18px] shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="absolute inset-0 rounded-[6px] border border-black/[0.15] dark:border-white/[0.2] bg-white dark:bg-white/[0.06] transition-all duration-200 peer-checked:border-[#4F46E5] peer-checked:bg-[#4F46E5] peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500/30" />
        <Check className="pointer-events-none absolute inset-0 m-auto h-3 w-3 scale-50 text-white opacity-0 transition-all duration-200 peer-checked:scale-100 peer-checked:opacity-100" strokeWidth={3} />
      </span>
      {label}
    </label>
  );
}
