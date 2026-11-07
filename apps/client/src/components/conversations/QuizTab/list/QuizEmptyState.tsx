"use client";

import { Check, Layers, PenLine, Sparkles } from "lucide-react";
import type { QuizSource } from "../types";
import { Button } from "../ui/primitives";

function Illustration() {
  return (
    <div className="relative mx-auto h-[168px] w-[220px]" aria-hidden>
      <div className="absolute left-4 top-3 w-[156px] -rotate-3 rounded-[20px] border border-[var(--border-subtle)] bg-card p-3 shadow-[var(--qz-shadow-float)]">
        {[true, true, false].map((done, i) => (
          <div key={i} className="flex items-center gap-2.5 py-2">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${done ? "bg-[var(--qz-success)] text-white" : "border-2 border-[var(--border-outline)]"}`}>
              {done && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span className="h-2 flex-1 rounded-full bg-[var(--qz-fill-strong)]" style={{ maxWidth: `${88 - i * 18}%` }} />
          </div>
        ))}
        <div className="mt-1 h-10 rounded-xl bg-[var(--qz-fill)]" />
      </div>
      <div className="qz-anim-breathe absolute -right-1 bottom-4 flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--qz-elevated)] px-3 py-2 text-[12px] font-semibold text-[var(--qz-ai)] shadow-[var(--qz-shadow-float)]">
        <Sparkles className="h-3.5 w-3.5" />
        Chấm tự luận thông minh
      </div>
    </div>
  );
}

export function QuizEmptyState({ onCreate }: { onCreate: (s: QuizSource) => void }) {
  return (
    <div className="qz-anim-pop mx-auto flex max-w-[560px] flex-col items-center px-2 py-12 text-center sm:py-20">
      <Illustration />
      <h2 className="mt-10 text-[28px] font-semibold leading-9 tracking-[-0.025em] text-foreground">Bạn chưa có bài kiểm tra nào</h2>
      <p className="mt-3 max-w-[440px] text-[15px] leading-6 text-[var(--on-surface-variant)]">
        Kết hợp trắc nghiệm và tự luận, AI sẽ chấm điểm theo ý nghĩa để bạn biết mình hiểu sâu đến đâu.
      </p>
      <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
        <Button variant="primary" size="lg" icon={<Sparkles className="h-4 w-4" />} onClick={() => onCreate("ai")}>
          Tạo đề bằng AI từ tài liệu
        </Button>
        <Button variant="secondary" size="lg" icon={<Layers className="h-4 w-4" />} onClick={() => onCreate("flashcard")}>
          Tạo từ bộ Flashcard
        </Button>
        <Button variant="tertiary" size="lg" icon={<PenLine className="h-4 w-4" />} onClick={() => onCreate("manual")}>
          Tự soạn đề
        </Button>
      </div>
    </div>
  );
}
