import { Plus, Sparkles } from "lucide-react";
import { Button, cx, FONT_HEADING, SearchInput } from "../ui";

interface Props {
  count: number;
  query: string;
  onQuery: (v: string) => void;
  onCreateAi: () => void;
  onCreate: () => void;
}

export function DecksToolbar({ count, query, onQuery, onCreateAi, onCreate }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className={cx(FONT_HEADING, "text-xl font-semibold tracking-[-0.015em] text-[#0B1C30]")}>
          {count} bộ thẻ
        </h2>
        <SearchInput className="w-56" value={query} onChange={onQuery} placeholder="Tìm bộ thẻ…" />
      </div>
      <div className="flex items-center gap-2">
        <Button icon={<Sparkles className="h-4 w-4 text-indigo-600" />} onClick={onCreateAi}>
          Tạo bằng AI
        </Button>
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={onCreate}>
          Tạo bộ thẻ mới
        </Button>
      </div>
    </div>
  );
}
