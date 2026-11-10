import { ArrowLeft, Trophy } from "lucide-react";
import { Button, cx, FONT_HEADING, StatTile } from "../ui";
import { formatDuration } from "../utils/srs";

interface Props {
  total: number;
  goodRate: number;
  seconds: number;
  onBack: () => void;
  onExtra: () => void;
}

/** B4 — Tổng kết phiên học chuẩn Apple Achievement Screen */
export function SessionSummary({ total, goodRate, seconds, onBack, onExtra }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-[28px] border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#161922] px-6 py-12 text-center shadow-xs animate-in fade-in zoom-in-95 duration-300">
      <span className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-linear-to-br from-[#4F46E5] to-[#7C3AED] text-white shadow-lg shadow-indigo-500/30">
        <Trophy className="h-10 w-10" />
      </span>
      <h2 className={cx(FONT_HEADING, "mt-6 max-w-lg text-2xl sm:text-[28px] font-bold leading-tight text-neutral-900 dark:text-white")}>
        Tuyệt vời! Bạn đã hoàn thành phiên ôn tập hôm nay.
      </h2>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Tiến độ lặp lại ngắt quãng (SRS) của bạn đã được cập nhật tự động.
      </p>
      <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile large label="Thẻ đã học" value={total} />
        <StatTile large label="Tỷ lệ ghi nhớ tốt" value={`${goodRate}%`} tone="green" />
        <StatTile large label="Thời gian học" value={formatDuration(seconds)} tone="indigo" />
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button variant="primary" size="lg" icon={<ArrowLeft className="h-4 w-4" />} onClick={onBack}>
          Quay về chi tiết bộ thẻ
        </Button>
        <Button size="lg" onClick={onExtra}>
          Ôn tập thêm ngoài lịch
        </Button>
      </div>
    </div>
  );
}
