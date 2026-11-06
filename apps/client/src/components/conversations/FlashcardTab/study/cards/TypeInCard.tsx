import { CheckCircle2 } from "lucide-react";
import { CARD_TYPE_LABEL } from "../../constants";
import { RichText, richToPlain } from "../../richtext";
import type { Flashcard } from "../../types";
import { Button, cx, FONT_HEADING, SQUIRCLE } from "../../ui";
import { diffTyped } from "../../utils/diff";
import { CardShell } from "./CardShell";

interface Props {
  card: Flashcard;
  revealed: boolean;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}

const normalizeAnswer = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
const nb = (s: string) => s.replace(/ /g, "\u00A0");

export function TypeInCard({ card, revealed, value, onChange, onSubmit }: Props) {
  const typed = value.trim();
  const normalizedTyped = normalizeAnswer(value);
  const expected = normalizeAnswer(richToPlain(card.back));
  const correct = revealed && normalizedTyped === expected;

  return (
    <CardShell typeLabel={CARD_TYPE_LABEL.typein} audioUrl={card.audioUrl}>
      {card.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.imageUrl} alt="" className="mb-5 max-h-36 rounded-2xl object-contain" />
      )}
      <RichText html={card.front} align="center" className={cx(FONT_HEADING, "text-2xl font-semibold tracking-[-0.02em] text-[#0B1C30] sm:text-3xl")} />

      <div className="mt-8 w-full max-w-md">
        {!revealed ? (
          <div className="flex gap-2 animate-in fade-in duration-300">
            <input
              autoFocus
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              placeholder="Nhập đáp án của bạn…"
              aria-label="Đáp án của bạn"
              style={SQUIRCLE}
              className="h-14 min-w-0 flex-1 rounded-2xl border-[1.5px] border-transparent bg-[#EFF4FF]/80 px-5 text-lg text-[#0B1C30] outline-none transition-all duration-300 placeholder:text-[#777587] focus:border-indigo-600 focus:bg-white focus:ring-[3px] focus:ring-indigo-600/15"
            />
            <Button variant="primary" className="h-14" onClick={onSubmit}>
              Kiểm tra
            </Button>
          </div>
        ) : correct ? (
          <div style={SQUIRCLE} className="flex items-center justify-center gap-2 rounded-2xl bg-[#6CF8BB]/35 px-5 py-4 text-lg font-bold text-[#005236] animate-in zoom-in-95 duration-300">
            <CheckCircle2 className="h-5 w-5" />
            {value}
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-left animate-in fade-in slide-in-from-bottom-1 duration-300">
            <div style={SQUIRCLE} className="rounded-2xl bg-[#EFF4FF]/80 px-5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#777587]">Bạn đã gõ</p>
              <p className="mt-1 break-all text-lg font-semibold">
                {typed ? (
                  diffTyped(value, expected).map((d, i) => (
                    <span key={i} className={d.ok ? "text-emerald-700" : "rounded-sm bg-[#FFDAD6] text-[#93000A] line-through"}>
                      {nb(d.ch)}
                    </span>
                  ))
                ) : (
                  <span className="font-normal italic text-[#777587]">(bỏ trống)</span>
                )}
              </p>
            </div>
            <div style={SQUIRCLE} className="rounded-2xl bg-[#6CF8BB]/30 px-5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#005236]/70">Đáp án</p>
              <p className="mt-1 break-all text-lg font-bold text-[#005236]">{expected}</p>
            </div>
          </div>
        )}
      </div>
    </CardShell>
  );
}
