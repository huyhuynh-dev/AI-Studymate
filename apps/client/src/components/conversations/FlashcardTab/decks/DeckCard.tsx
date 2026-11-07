import { Check, Layers, Pencil, Play, Trash2 } from "lucide-react";
import type { Deck, DeckStats } from "../types";
import { Button, cx, FONT_HEADING, GLASS, Menu, Pill, SHADOW_1, SHADOW_HOVER, SPRING, SQUIRCLE, TriProgress } from "../ui";

interface Props {
  deck: Deck;
  stats: DeckStats;
  onOpen: () => void;
  onStudy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** A2 — Thẻ đại diện cho một Deck chuẩn Apple HIG (Concentric Squircle: Outer 22px -> Inner Icon 12px) */
export function DeckCard({ deck, stats, onOpen, onStudy, onEdit, onDelete }: Props) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
      style={SQUIRCLE}
      className={cx(
        GLASS,
        SHADOW_1,
        SHADOW_HOVER,
        "group flex cursor-pointer flex-col gap-4 rounded-[22px] p-5 outline-none transition-all duration-300 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-indigo-500/40 active:scale-[0.99]",
        SPRING
      )}
    >
      {/* Header: Icon Squircle đồng tâm + Tên bộ thẻ + Menu */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 transition-colors group-hover:bg-indigo-500/15">
            <Layers className="h-5 w-5" />
          </div>
          <h3 className={cx(FONT_HEADING, "line-clamp-1 text-base font-semibold text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors")}>
            {deck.name}
          </h3>
        </div>
        <div className="-mr-1.5 -mt-0.5 shrink-0">
          <Menu
            label="Tùy chọn bộ thẻ"
            items={[
              { label: "Chỉnh sửa thông tin", icon: <Pencil className="h-3.5 w-3.5" />, onClick: onEdit },
              { label: "Xóa bộ thẻ", icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, onClick: onDelete },
            ]}
          />
        </div>
      </div>

      {/* Mô tả */}
      <p className="line-clamp-2 min-h-10 text-[13px] leading-5 text-neutral-500 dark:text-neutral-400">
        {deck.description || "Chưa có mô tả cho bộ thẻ này."}
      </p>

      {/* Thanh tiến độ 3 màu */}
      <TriProgress newCount={stats.new} learning={stats.learning} review={stats.review} />

      {/* Các huy hiệu trạng thái */}
      <div className="flex min-h-[22px] flex-wrap gap-1.5">
        {stats.new > 0 && <Pill tone="blue">{stats.new} Mới</Pill>}
        {stats.learning > 0 && <Pill tone="amber">{stats.learning} Đang học</Pill>}
        {stats.dueToday > 0 && <Pill tone="green">{stats.dueToday} Cần ôn hôm nay</Pill>}
      </div>

      {/* Footer: Tổng số thẻ & CTA */}
      <div className="mt-auto flex items-center justify-between border-t border-black/[0.05] dark:border-white/[0.06] pt-3.5">
        <span className="tabular-nums text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {stats.total} thẻ
        </span>
        {stats.total === 0 ? (
          <span className="text-xs text-neutral-400 dark:text-neutral-500">Chưa có thẻ</span>
        ) : stats.dueToday > 0 ? (
          <Button
            size="sm"
            variant="primary"
            icon={<Play className="h-3 w-3 fill-current" />}
            onClick={(e) => {
              e.stopPropagation();
              onStudy();
            }}
          >
            <span className="tabular-nums">Ôn tập · {stats.dueToday}</span>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="success"
            icon={<Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
            onClick={(e) => {
              e.stopPropagation();
              onStudy();
            }}
          >
            Đã hoàn thành
          </Button>
        )}
      </div>
    </div>
  );
}
