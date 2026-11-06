import { CARD_TYPE_LABEL } from "../../constants";
import type { Flashcard } from "../../types";
import { Collapse, cx, EASE_IOS, FONT_HEADING } from "../../ui";
import { CardShell } from "./CardShell";

export function BasicCard({ card, revealed, onReveal }: { card: Flashcard; revealed: boolean; onReveal: () => void }) {
  return (
    <CardShell typeLabel={CARD_TYPE_LABEL.basic} audioUrl={card.audioUrl} onClick={revealed ? undefined : onReveal}>
      {card.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.imageUrl} alt="" className="mb-5 max-h-40 rounded-2xl object-contain" />
      )}
      <p
        className={cx(
          FONT_HEADING,
          "whitespace-pre-wrap font-semibold tracking-[-0.02em] transition-all duration-500",
          EASE_IOS,
          revealed ? "text-lg text-[#464555]/70" : "text-3xl text-[#0B1C30] sm:text-4xl"
        )}
      >
        {card.front}
      </p>
      <Collapse open={revealed} className="w-full">
        <div className="mt-6 border-t border-black/[0.06] pt-6">
          <p className={cx(FONT_HEADING, "whitespace-pre-wrap text-2xl font-semibold tracking-[-0.02em] text-[#0B1C30] sm:text-3xl")}>{card.back}</p>
        </div>
      </Collapse>
      <Collapse open={!revealed}>
        <p className="mt-8 text-[13px] text-[#777587]">Nhấn phím Space hoặc chạm vào thẻ để xem đáp án</p>
      </Collapse>
    </CardShell>
  );
}
