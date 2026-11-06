import { CARD_TYPE_LABEL } from "../../constants";
import { ClozeText } from "../../shared/ClozeText";
import type { Flashcard } from "../../types";
import { Collapse, cx, FONT_HEADING } from "../../ui";
import { CardShell } from "./CardShell";

export function ClozeCard({ card, revealed, onReveal }: { card: Flashcard; revealed: boolean; onReveal: () => void }) {
  return (
    <CardShell typeLabel={CARD_TYPE_LABEL.cloze} audioUrl={card.audioUrl} onClick={revealed ? undefined : onReveal}>
      {card.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.imageUrl} alt="" className="mb-5 max-h-40 rounded-2xl object-contain" />
      )}
      <p className={cx(FONT_HEADING, "text-2xl font-semibold leading-[1.8] tracking-[-0.015em] text-[#0B1C30] sm:text-3xl sm:leading-[1.7]")}>
        <ClozeText text={card.front} mode={revealed ? "revealed" : "hidden"} />
      </p>
      <Collapse open={revealed && !!card.back} className="w-full">
        <div className="mt-6 border-t border-black/[0.06] pt-5">
          <p className="whitespace-pre-wrap text-[15px] leading-6 text-[#464555]">{card.back}</p>
        </div>
      </Collapse>
      <Collapse open={!revealed}>
        <p className="mt-8 text-[13px] text-[#777587]">Nhấn phím Space hoặc chạm vào thẻ để xem đáp án</p>
      </Collapse>
    </CardShell>
  );
}
