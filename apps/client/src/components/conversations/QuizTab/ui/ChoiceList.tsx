"use client";

import { Check, X } from "lucide-react";
import type { QuizOption } from "../types";
import { OPTION_LETTERS } from "../constants";
import { cx } from "../utils";

/** Danh sách lựa chọn dùng chung cho lúc làm bài (tương tác) và xem lại (reveal). */
export function ChoiceList({ options, selectedIds, multi, tf, reveal, disabled, onToggle }: {
  options: QuizOption[]; selectedIds: string[]; multi?: boolean; tf?: boolean;
  reveal?: boolean; disabled?: boolean; onToggle?: (id: string) => void;
}) {
  return (
    <ul
      role={multi ? "group" : "radiogroup"}
      className={cx("grid gap-3", tf ? "grid-cols-2" : "grid-cols-1")}
    >
      {options.map((o, i) => {
        const selected = selectedIds.includes(o.id);
        const state = reveal ? (o.isCorrect ? "correct" : selected ? "wrong" : "idle") : selected ? "selected" : "idle";
        const box = {
          idle: "border-[var(--border-outline)] bg-card hover:border-primary/60 hover:bg-[var(--qz-fill)]",
          selected: "border-primary bg-[var(--qz-primary-soft)]",
          correct: "border-[var(--qz-success)] bg-[var(--qz-success-soft)]",
          wrong: "border-[var(--qz-danger)] bg-[var(--qz-danger-soft)]",
        }[state];
        const marker = (
          <span
            className={cx(
              "flex h-7 w-7 shrink-0 items-center justify-center border-[1.5px] text-[13px] font-semibold",
              multi ? "rounded-lg" : "rounded-full",
              state === "selected" && "border-primary bg-primary text-white",
              state === "correct" && "border-[var(--qz-success)] bg-[var(--qz-success)] text-white",
              state === "wrong" && "border-[var(--qz-danger)] bg-[var(--qz-danger)] text-white",
              state === "idle" && "border-[var(--border-outline)] text-[var(--on-surface-variant)]",
            )}
            aria-hidden
          >
            {state === "correct" ? <Check className="h-4 w-4" strokeWidth={3} /> : state === "wrong" ? <X className="h-4 w-4" strokeWidth={3} /> : multi && state === "selected" ? <Check className="h-4 w-4" strokeWidth={3} /> : tf ? "" : OPTION_LETTERS[i]}
          </span>
        );
        return (
          <li key={o.id}>
            <button
              type="button"
              role={multi ? "checkbox" : "radio"}
              aria-checked={selected}
              disabled={disabled || !onToggle}
              onClick={() => onToggle?.(o.id)}
              className={cx(
                "apple-spring flex w-full items-center gap-3.5 rounded-2xl border-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] active:scale-[0.99] disabled:cursor-default disabled:active:scale-100",
                tf ? "min-h-[64px] justify-center px-4 text-[17px] font-semibold" : "min-h-14 px-4 py-3 text-[15.5px] leading-6",
                box,
                reveal && state === "idle" && "opacity-70",
              )}
            >
              {!tf && marker}
              <span className="min-w-0 flex-1">{tf ? <span className="flex items-center justify-center gap-2.5">{marker}{o.text}</span> : o.text}</span>
              {reveal && state === "correct" && <span className="shrink-0 text-[12px] font-semibold text-[var(--qz-success)]">Đáp án đúng</span>}
              {reveal && state === "wrong" && <span className="shrink-0 text-[12px] font-semibold text-[var(--qz-danger)]">Bạn đã chọn</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
