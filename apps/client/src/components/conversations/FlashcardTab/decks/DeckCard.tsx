import { Check, Pencil, Trash2 } from "lucide-react";
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

/** A2 — Thẻ đại diện cho một Deck */
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
        "group flex cursor-pointer flex-col gap-4 rounded-2xl p-5 outline-none transition-all duration-500 hover:-translate-y-1 hover:bg-white/90 focus-visible:ring-[3px] focus-visible:ring-indigo-600/25 active:scale-[0.99]",
        SPRING
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className={cx(FONT_HEADING, "line-clamp-1 text-base font-semibold tracking-[-0.01em] text-[#0B1C30]")}>{deck.name}</h3>
        <div className="-mr-2 -mt-1">
          <Menu
            label="Tùy chọn bộ thẻ"
            items={[
              { label: "Chỉnh sửa thông tin", icon: <Pencil className="h-3.5 w-3.5" />, onClick: onEdit },
              { label: "Xóa bộ thẻ", icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, onClick: onDelete },
            ]}
          />
        </div>
      </div>

      <p className="line-clamp-2 min-h-10 text-[13px] leading-5 text-[#464555]/70">{deck.description || "Chưa có mô tả."}</p>

      <TriProgress newCount={stats.new} learning={stats.learning} review={stats.review} />

      <div className="flex flex-wrap gap-1.5">
        <Pill tone="blue">{stats.new} Mới</Pill>
        <Pill tone="amber">{stats.learning} Đang học</Pill>
        <Pill tone="green">{stats.dueToday} Cần ôn hôm nay</Pill>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-black/[0.05] pt-4">
        <span className="text-[12px] text-[#777587]">{stats.total} thẻ</span>
        {stats.total === 0 ? (
          <span className="text-[12px] text-[#777587]">Chưa có thẻ</span>
        ) : stats.dueToday > 0 ? (
          <Button
            size="sm"
            variant="primary"
            onClick={(e) => {
              e.stopPropagation();
              onStudy();
            }}
          >
            Ôn tập ngay · {stats.dueToday}
          </Button>
        ) : (
          <Button size="sm" variant="success" icon={<Check className="h-3.5 w-3.5" strokeWidth={3} />} onClick={(e) => e.stopPropagation()}>
            Đã hoàn thành
          </Button>
        )}
      </div>
    </div>
  );
}
