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

/** B4 — Tổng kết phiên học */
export function SessionSummary({ total, goodRate, seconds, onBack, onExtra }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center animate-in fade-in zoom-in-95 duration-500">
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-[#6F3DD9] text-white shadow-[0_20px_40px_-10px_rgba(79,70,229,0.5)]">
        <Trophy className="h-11 w-11" />
      </span>
      <h2 className={cx(FONT_HEADING, "mt-8 max-w-lg text-[26px] font-bold leading-tight tracking-[-0.025em] text-[#0B1C30] sm:text-[32px]")}>
        Tuyệt vời! Bạn đã hoàn thành phiên ôn tập hôm nay.
      </h2>
      <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile large label="Thẻ đã học" value={total} />
        <StatTile large label="Tỷ lệ ghi nhớ tốt" value={`${goodRate}%`} tone="green" />
        <StatTile large label="Thời gian tập trung" value={formatDuration(seconds)} tone="indigo" />
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
