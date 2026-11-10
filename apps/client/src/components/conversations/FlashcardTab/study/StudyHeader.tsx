import { Pencil, X } from "lucide-react";
import { Button, IconButton } from "../ui";

interface Props {
  progress: number;
  remaining: { new: number; learning: number; review: number };
  onExit: () => void;
  onEdit: () => void;
}

/** B3 — Thanh trạng thái phiên học chuẩn Apple Floating Bar */
export function StudyHeader({ progress, remaining, onExit, onEdit }: Props) {
  const pct = Math.round(progress * 100);
  return (
    <header className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#161922]/80 px-4 py-2.5 backdrop-blur-md shadow-2xs">
      <Button variant="secondary" size="sm" icon={<X className="h-3.5 w-3.5" />} onClick={onExit}>
        Kết thúc
      </Button>

      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-1.5">
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200/80 dark:bg-white/[0.08]"
        >
          <div
            className="h-full rounded-full bg-[#4F46E5] transition-[width] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center gap-4 text-[11px] font-semibold font-heading tabular-nums">
          <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400" title="Thẻ mới">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            {remaining.new} mới
          </span>
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400" title="Đang học">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {remaining.learning} đang học
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400" title="Ôn tập">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {remaining.review} ôn tập
          </span>
          <span className="font-medium text-neutral-400 dark:text-neutral-500">· {pct}%</span>
        </div>
      </div>

      <IconButton
        label="Sửa thẻ"
        onClick={onEdit}
        className="h-8 w-8 border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-white/[0.06]"
      >
        <Pencil className="h-3.5 w-3.5" />
      </IconButton>
    </header>
  );
}
