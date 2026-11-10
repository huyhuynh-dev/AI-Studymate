import { Search } from "lucide-react";
import { Input } from "./Field";

export function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={className}>
      <Input compact value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} leftIcon={<Search className="h-4 w-4" />} />
    </div>
  );
}
