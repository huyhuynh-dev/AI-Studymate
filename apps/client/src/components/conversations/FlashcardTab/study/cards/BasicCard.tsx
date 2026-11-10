import { CARD_TYPE_LABEL } from "../../constants";
import { RichText } from "../../richtext";
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
      <RichText
        html={card.front}
        align="center"
        className={cx(
          FONT_HEADING,
          "font-semibold transition-all duration-300",
          EASE_IOS,
          revealed
            ? "text-base sm:text-lg text-neutral-500 dark:text-neutral-400"
            : "text-2xl sm:text-3xl text-neutral-900 dark:text-white"
        )}
      />
      <Collapse open={revealed} className="w-full">
        <div className="mt-6 border-t border-black/[0.06] dark:border-white/[0.08] pt-6">
          <RichText
            html={card.back}
            align="center"
            className={cx(FONT_HEADING, "text-xl sm:text-2xl font-semibold text-neutral-900 dark:text-white")}
          />
        </div>
      </Collapse>
      <Collapse open={!revealed}>
        <p className="mt-8 text-xs font-medium text-neutral-400 dark:text-neutral-500">
          Nhấn phím{" "}
          <kbd className="rounded border border-black/[0.1] dark:border-white/[0.15] bg-neutral-100 dark:bg-white/[0.06] px-1.5 py-0.5 font-sans text-[11px] font-semibold">
            Space
          </kbd>{" "}
          hoặc chạm vào thẻ để xem đáp án
        </p>
      </Collapse>
    </CardShell>
  );
}
