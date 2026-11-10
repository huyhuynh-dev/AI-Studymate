"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Layers, RotateCcw } from "lucide-react";
import type { DeckOption, EvaluationStatus, FlashcardTarget, Quiz, QuizAttempt } from "../types";
import { Button, Card, ScoreRing } from "../ui/primitives";
import { cx, formatDuration, scoreLabel, summarizeAttempt, toPct, toScale10, toneForPct, fmtPoints } from "../utils";
import { TONE } from "../constants";
import { ReviewCard } from "./ReviewCard";
import { FlashcardBridgeDialog } from "./FlashcardBridgeDialog";

type Filter = "all" | "incorrect" | "partial" | "correct" | "essay";

export function ResultView({ quiz, attempt, decks, onBack, onRetryAll, onRetryIncomplete, onOverride, onConvert }: {
  quiz: Quiz; attempt: QuizAttempt; decks: DeckOption[];
  onBack: () => void; onRetryAll: () => void; onRetryIncomplete: (ids: string[]) => void;
  onOverride: (questionId: string, status: Exclude<EvaluationStatus, "pending">) => Promise<void>;
  onConvert: (questionIds: string[], target: FlashcardTarget) => Promise<void>;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [bridge, setBridge] = useState(false);

  const ids = attempt.config?.questionOrder ?? quiz.questions.map((q) => q.id);
  const questions = useMemo(() => quiz.questions.filter((q) => ids.includes(q.id)), [quiz.questions, ids]);
  const sum = summarizeAttempt(attempt, questions);
  const pct = toPct(attempt.score, attempt.maxScore);
  const tone = toneForPct(pct);
  const incomplete = questions.filter((q) => (attempt.answers[q.id]?.evaluationStatus ?? "incorrect") !== "correct");
  const st = (id: string) => attempt.answers[id]?.evaluationStatus ?? "incorrect";

  const filters: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "Tất cả", n: questions.length },
    { key: "incorrect", label: "Sai", n: sum.incorrect },
    { key: "partial", label: "Đúng một phần", n: sum.partial },
    { key: "correct", label: "Đúng", n: sum.correct },
    { key: "essay", label: "Tự luận", n: questions.filter((q) => q.type === "essay").length },
  ];
  const visible = questions.filter((q) => filter === "all" ? true : filter === "essay" ? q.type === "essay" : st(q.id) === filter);

  return (
    <div className="mx-auto max-w-[960px]">
      <Card className="p-6 sm:p-8">
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-center">
          <div className="flex flex-col items-center text-center">
            <ScoreRing pct={pct} tone={tone} size={148} stroke={11}>
              <span className={cx("text-[40px] font-semibold font-heading leading-none tabular-nums tracking-[-0.03em]", TONE[tone].text)}>{String(toScale10(attempt.score, attempt.maxScore)).replace(".", ",")}</span>
              <span className="mt-1 text-[13px] font-medium tabular-nums text-[var(--on-surface-variant)]">/ 10 · {pct}%</span>
            </ScoreRing>
            <p className="mt-3 text-[17px] font-semibold font-heading tracking-[-0.01em]">{scoreLabel(pct)}</p>
            <p className="text-[13px] tabular-nums text-[var(--on-surface-variant)]">{fmtPoints(attempt.score)}/{fmtPoints(attempt.maxScore)} điểm</p>
          </div>

          <div className="grid w-full flex-1 grid-cols-2 gap-3">
            {[
              { label: "Đúng", value: sum.correct, tone: TONE.success },
              { label: "Đúng một phần", value: sum.partial, tone: TONE.warning },
              { label: "Sai / Bỏ trống", value: sum.incorrect, tone: TONE.danger },
              { label: "Thời gian", value: formatDuration(attempt.timeSpentSec), tone: TONE.neutral },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-[var(--qz-fill)] p-4">
                <p className="text-[12.5px] font-semibold text-[var(--on-surface-variant)]">{s.label}</p>
                <p className={cx("mt-1 text-[24px] font-semibold font-heading leading-8 tabular-nums tracking-[-0.02em]", s.tone.text)}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {incomplete.length > 0 ? (
            <>
              <Button variant="primary" size="lg" icon={<RotateCcw className="h-4 w-4" />} onClick={() => onRetryIncomplete(incomplete.map((q) => q.id))}>Chỉ làm lại {incomplete.length} câu chưa đúng</Button>
              <Button variant="secondary" size="lg" onClick={onRetryAll}>Làm lại toàn bộ đề</Button>
            </>
          ) : (
            <Button variant="primary" size="lg" icon={<RotateCcw className="h-4 w-4" />} onClick={onRetryAll}>Làm lại toàn bộ đề</Button>
          )}
          <Button variant="tertiary" size="lg" icon={<ArrowLeft className="h-4 w-4" />} onClick={onBack}>Về chi tiết đề</Button>
        </div>
      </Card>

      {incomplete.length > 0 && (
        <div className="mt-4 flex flex-col gap-4 rounded-[24px] bg-[var(--qz-ai-soft)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--qz-elevated)] text-[var(--qz-ai)]"><Layers className="h-5 w-5" /></span>
            <p className="text-[14.5px] leading-6"><strong className="font-semibold">{incomplete.length} câu chưa trọn vẹn.</strong> Biến chúng thành Flashcard để ôn tập ngắt quãng.</p>
          </div>
          <Button variant="secondary" className="shrink-0" onClick={() => setBridge(true)}>Chuyển thành Flashcard</Button>
        </div>
      )}

      <section className="mt-8 pb-10" aria-labelledby="qz-review">
        <h2 id="qz-review" className="px-1 text-[20px] font-semibold tracking-[-0.015em]">Xem lại bài làm</h2>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0" role="group" aria-label="Lọc câu hỏi">
          {filters.filter((f) => f.key === "all" || f.n > 0).map((f) => (
            <button
              key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
              className={cx("apple-spring inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.97] sm:h-9",
                filter === f.key ? "border-primary bg-primary text-white" : "border-[var(--border-outline)] bg-card text-[var(--on-surface-variant)] hover:border-primary")}
            >
              {f.label}<span className="tabular-nums opacity-80">{f.n}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-4">
          {visible.map((q) => (
            <ReviewCard
              key={q.id} index={quiz.questions.findIndex((x) => x.id === q.id)} q={q} a={attempt.answers[q.id]}
              onOverride={q.type === "essay" ? (s) => onOverride(q.id, s) : undefined}
            />
          ))}
        </div>
      </section>

      {bridge && (
        <FlashcardBridgeDialog quizTitle={quiz.title} questions={incomplete} decks={decks} onClose={() => setBridge(false)} onSubmit={onConvert} />
      )}
    </div>
  );
}
