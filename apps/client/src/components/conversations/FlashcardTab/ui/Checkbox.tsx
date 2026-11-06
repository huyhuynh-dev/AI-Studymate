import { Check } from "lucide-react";

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2.5 text-sm text-[#464555]">
      <span className="relative flex h-[18px] w-[18px] shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="absolute inset-0 rounded-md border-[1.5px] border-[#777587]/60 bg-white transition-all duration-300 peer-checked:border-indigo-600 peer-checked:bg-indigo-600 peer-focus-visible:ring-[3px] peer-focus-visible:ring-indigo-600/20" />
        <Check className="pointer-events-none absolute inset-0 m-auto h-3 w-3 scale-50 text-white opacity-0 transition-all duration-300 peer-checked:scale-100 peer-checked:opacity-100" strokeWidth={3} />
      </span>
      {label}
    </label>
  );
}
