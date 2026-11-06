import { Image as ImageIcon, Pencil, Trash2, Volume2 } from "lucide-react";
import { CARD_TYPE_LABEL, CARD_TYPE_TONE, STATUS_META } from "../constants";
import { richToPlain } from "../richtext";
import type { Flashcard } from "../types";
import { dueLabel } from "../utils/srs";
import { cx, IconButton, Pill, SQUIRCLE } from "../ui";

/** A4 — Một hàng flashcard: loại · nội dung · SRS · thao tác nhanh (hiện khi hover) */
export function CardRow({ card, onEdit, onDelete }: { card: Flashcard; onEdit: () => void; onDelete: () => void }) {
  const status = STATUS_META[card.status];
  // Danh sách chỉ cần 1 dòng chữ thuần → richToPlain (chỗ trống hiện dạng [từ khóa])
  const front = richToPlain(card.front);
  const back = richToPlain(card.back);
  return (
    <div
      style={SQUIRCLE}
      className="group flex items-center gap-4 rounded-2xl px-4 py-3 transition-all duration-300 hover:bg-white hover:shadow-[0_6px_20px_-8px_rgba(11,28,48,0.12)]"
    >
      <Pill tone={CARD_TYPE_TONE[card.type]} className="w-24 shrink-0 justify-center">
        {CARD_TYPE_LABEL[card.type]}
      </Pill>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-[#0B1C30]">{front}</p>
          {card.imageUrl && <ImageIcon className="h-3.5 w-3.5 shrink-0 text-[#777587]" />}
          {card.audioUrl && <Volume2 className="h-3.5 w-3.5 shrink-0 text-[#777587]" />}
        </div>
        <p className="truncate text-[13px] text-[#464555]/65">{back || "—"}</p>
      </div>

      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
        <Pill tone={status.tone}>{status.label}</Pill>
        <span className="text-[11px] text-[#777587]">{dueLabel(card)}</span>
      </div>

      <div className={cx("flex shrink-0 gap-0.5 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100")}>
        <IconButton label="Sửa thẻ" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </IconButton>
        <IconButton label="Xóa thẻ" tone="danger" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}
