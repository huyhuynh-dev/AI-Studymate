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
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] dark:border-white/[0.08] pb-4">
      <div className="flex items-center gap-2.5">
        <h2 className={cx(FONT_HEADING, "text-lg font-bold text-neutral-900 dark:text-white")}>
          Bộ thẻ ghi nhớ
        </h2>
        <span className="tabular-nums inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 px-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
          {count}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput className="w-48 sm:w-56" value={query} onChange={onQuery} placeholder="Tìm bộ thẻ…" />
        <Button icon={<Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />} onClick={onCreateAi}>
          <span className="hidden sm:inline">Tạo bằng AI</span>
          <span className="sm:hidden">AI</span>
        </Button>
        <Button variant="primary" icon={<Plus className="h-4 w-4 stroke-[2.5]" />} onClick={onCreate}>
          <span className="hidden sm:inline">Tạo bộ thẻ mới</span>
          <span className="sm:hidden">Tạo mới</span>
        </Button>
      </div>
    </div>
  );
}
