import { Pencil, Play, Plus, Sparkles } from "lucide-react";
import type { Deck, DeckStats } from "../types";
import { Button, cx, FONT_HEADING, GLASS, IconButton, SHADOW_1, SQUIRCLE, StatTile } from "../ui";

interface Props {
  deck: Deck;
  stats: DeckStats;
  onEdit: () => void;
  onStudy: () => void;
  onAddCard: () => void;
  onAi: () => void;
}

/** A4 / Tầng 2 — Khung thông tin tổng quan & thống kê */
export function DeckOverviewBanner({ deck, stats, onEdit, onStudy, onAddCard, onAi }: Props) {
  return (
    <section style={SQUIRCLE} className={cx(GLASS, SHADOW_1, "grid gap-6 rounded-3xl p-6 lg:grid-cols-[1fr_300px] lg:p-8")}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h2 className={cx(FONT_HEADING, "text-[26px] font-bold tracking-[-0.025em] text-[#0B1C30] sm:text-[32px]")}>{deck.name}</h2>
          <IconButton label="Sửa tên và mô tả" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </IconButton>
        </div>
        <p className="mt-2 text-[15px] leading-6 text-[#464555]/75">{deck.description || "Chưa có mô tả cho bộ thẻ này."}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Tổng số thẻ" value={stats.total} />
          <StatTile label="Thẻ mới" value={stats.new} tone="blue" />
          <StatTile label="Đang học" value={stats.learning} tone="amber" />
          <StatTile label="Cần ôn hôm nay" value={stats.dueToday} tone="green" />
        </div>
      </div>

      <div className="flex flex-col justify-center gap-3">
        <Button variant="primary" size="lg" fullWidth disabled={stats.total === 0} icon={<Play className="h-4 w-4 fill-current" />} onClick={onStudy}>
          Bắt đầu học
          {stats.dueToday > 0 && <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{stats.dueToday} thẻ</span>}
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button icon={<Plus className="h-4 w-4" />} onClick={onAddCard}>
            Thêm thẻ
          </Button>
          <Button icon={<Sparkles className="h-4 w-4 text-indigo-600" />} onClick={onAi}>
            AI tạo thêm
          </Button>
        </div>
      </div>
    </section>
  );
}
