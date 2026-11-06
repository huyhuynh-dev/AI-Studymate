import { Image as ImageIcon, Pencil, Trash2, Volume2 } from "lucide-react";
import { CARD_TYPE_LABEL, CARD_TYPE_TONE, STATUS_META } from "../constants";
import { richToPlain } from "../richtext";
import type { Flashcard } from "../types";
import { dueLabel } from "../utils/srs";
import { cx, IconButton, Pill, SQUIRCLE } from "../ui";

/** A4 — Một hàng flashcard chuẩn Apple Inset Grouped Row: loại · nội dung · SRS · thao tác nhanh */
export function CardRow({ card, onEdit, onDelete }: { card: Flashcard; onEdit: () => void; onDelete: () => void }) {
  const status = STATUS_META[card.status];
  const front = richToPlain(card.front);
  const back = richToPlain(card.back);

  return (
    <div
      style={SQUIRCLE}
      onClick={onEdit}
      className="group flex cursor-pointer items-center gap-3.5 rounded-[18px] border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#161922] px-4 py-3.5 shadow-2xs transition-all duration-200 hover:border-indigo-500/30 dark:hover:border-indigo-500/40 hover:bg-neutral-50/60 dark:hover:bg-[#1B1F2A] hover:shadow-sm select-none"
    >
      <Pill tone={CARD_TYPE_TONE[card.type]} className="w-24 shrink-0 justify-center">
        {CARD_TYPE_LABEL[card.type]}
      </Pill>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {front}
          </p>
          {card.imageUrl && <ImageIcon className="h-3.5 w-3.5 shrink-0 text-neutral-400 dark:text-neutral-500" />}
          {card.audioUrl && <Volume2 className="h-3.5 w-3.5 shrink-0 text-neutral-400 dark:text-neutral-500" />}
        </div>
        <p className="mt-0.5 truncate text-[13px] text-neutral-500 dark:text-neutral-400">{back || "—"}</p>
      </div>

      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
        <Pill tone={status.tone}>{status.label}</Pill>
        <span className="tabular-nums text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
          {dueLabel(card)}
        </span>
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        className={cx(
          "flex shrink-0 gap-1 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
        )}
      >
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
