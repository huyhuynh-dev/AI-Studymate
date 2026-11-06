import { Pencil, X } from "lucide-react";
import { Button, IconButton } from "../ui";

interface Props {
  progress: number;
  remaining: { new: number; learning: number; review: number };
  onExit: () => void;
  onEdit: () => void;
}

/** B3 — Thanh trạng thái phiên học */
export function StudyHeader({ progress, remaining, onExit, onEdit }: Props) {
  const pct = Math.round(progress * 100);
  return (
    <header className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
      <Button variant="ghost" size="sm" icon={<X className="h-4 w-4" />} onClick={onExit}>
        Kết thúc
      </Button>
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-2">
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5EEFF]"
        >
          <div className="h-full rounded-full bg-indigo-600 transition-[width] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center gap-4 text-[12px] font-bold tabular-nums">
          <span className="text-blue-600" title="Thẻ mới">{remaining.new}</span>
          <span className="text-amber-600" title="Đang học">{remaining.learning}</span>
          <span className="text-emerald-600" title="Ôn tập">{remaining.review}</span>
          <span className="font-medium text-[#777587]">{pct}%</span>
        </div>
      </div>
      <IconButton label="Sửa thẻ" onClick={onEdit} className="h-9 w-9">
        <Pencil className="h-4 w-4" />
      </IconButton>
    </header>
  );
}
