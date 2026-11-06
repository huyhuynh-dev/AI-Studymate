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
      <RichText
        html={card.front}
        align="center"
        className={cx(FONT_HEADING, "text-xl sm:text-2xl font-semibold text-neutral-900 dark:text-white")}
      />

      <div className="mt-8 w-full max-w-md">
        {!revealed ? (
          <div className="flex gap-2 animate-in fade-in duration-200">
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
              className="h-12 min-w-0 flex-1 rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-neutral-100/80 dark:bg-white/[0.05] px-4 text-base text-neutral-900 dark:text-white outline-none transition-all duration-200 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:border-indigo-500 focus:bg-white dark:focus:bg-[#161922] focus:ring-3 focus:ring-indigo-500/15"
            />
            <Button variant="primary" className="h-12 px-5" onClick={onSubmit}>
              Kiểm tra
            </Button>
          </div>
        ) : correct ? (
          <div
            style={SQUIRCLE}
            className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/15 px-5 py-3.5 text-base font-bold text-emerald-700 dark:text-emerald-400 animate-in zoom-in-95 duration-200"
          >
            <CheckCircle2 className="h-5 w-5" />
            {value}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 text-left animate-in fade-in slide-in-from-bottom-1 duration-200">
            <div
              style={SQUIRCLE}
              className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/80 dark:bg-white/[0.04] px-4 py-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                Bạn đã gõ
              </p>
              <p className="mt-1 break-all text-base font-semibold">
                {typed ? (
                  diffTyped(value, expected).map((d, i) => (
                    <span
                      key={i}
                      className={
                        d.ok
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "rounded-sm bg-rose-500/15 text-rose-700 dark:text-rose-400 line-through"
                      }
                    >
                      {nb(d.ch)}
                    </span>
                  ))
                ) : (
                  <span className="font-normal italic text-neutral-400 dark:text-neutral-500">(bỏ trống)</span>
                )}
              </p>
            </div>
            <div
              style={SQUIRCLE}
              className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/70 dark:text-emerald-400/70">
                Đáp án chính xác
              </p>
              <p className="mt-1 break-all text-base font-bold text-emerald-700 dark:text-emerald-400">{expected}</p>
            </div>
          </div>
        )}
      </div>
    </CardShell>
  );
}
