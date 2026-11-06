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

/** A4 / Tầng 2 — Khung thông tin tổng quan & thống kê chuẩn Apple Bento */
export function DeckOverviewBanner({ deck, stats, onEdit, onStudy, onAddCard, onAi }: Props) {
  return (
    <section
      style={SQUIRCLE}
      className={cx(GLASS, SHADOW_1, "flex flex-col gap-6 rounded-[24px] p-5 sm:p-6")}
    >
      {/* Hàng trên: Tiêu đề, mô tả và Cụm nút hành động chính */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className={cx(FONT_HEADING, "text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white")}>
              {deck.name}
            </h2>
            <IconButton label="Sửa tên và mô tả" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </IconButton>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            {deck.description || "Chưa có mô tả cho bộ thẻ này."}
          </p>
        </div>

        {/* Cụm nút hành động: 1 Primary CTA ("Bắt đầu học") + 2 Secondary Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button icon={<Plus className="h-4 w-4" />} onClick={onAddCard}>
            Thêm thẻ
          </Button>
          <Button icon={<Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />} onClick={onAi}>
            AI tạo thêm
          </Button>
          <Button
            variant="primary"
            disabled={stats.total === 0}
            icon={<Play className="h-3.5 w-3.5 fill-current" />}
            onClick={onStudy}
          >
            <span>Bắt đầu học</span>
            {stats.dueToday > 0 && (
              <span className="tabular-nums rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">
                {stats.dueToday}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Hàng dưới: 4 Ô thống kê SRS chuẩn Apple StatTile (tabular-nums) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Tổng số thẻ" value={stats.total} />
        <StatTile label="Thẻ mới" value={stats.new} tone="blue" />
        <StatTile label="Đang học" value={stats.learning} tone="amber" />
        <StatTile label="Cần ôn hôm nay" value={stats.dueToday} tone="green" />
      </div>
    </section>
  );
}
