"use client";

import { useState } from "react";
import { Lightbulb, Sparkles, Check, TriangleAlert } from "lucide-react";
import type { AttemptAnswer, EvaluationStatus, QuizQuestion } from "../types";
import { Badge, Button, Segmented } from "../ui/primitives";
import { RichTextView } from "../ui/RichTextView";
import { ChoiceList } from "../ui/ChoiceList";
import { TypeBadge } from "../ui/badges";
import { EVAL_META } from "../constants";
import { cx, fmtPoints, isAnswered, isHtmlEmpty } from "../utils";

function Box({ title, tone, children, className }: { title: string; tone?: "success" | "danger" | "neutral"; children: React.ReactNode; className?: string }) {
  const bg = tone === "success" ? "bg-[var(--qz-success-soft)]" : tone === "danger" ? "bg-[var(--qz-danger-soft)]" : "bg-[var(--qz-fill)]";
  return (
    <div className={cx("rounded-2xl p-4", bg, className)}>
      <p className="mb-2 text-[12.5px] font-semibold text-[var(--on-surface-variant)]">{title}</p>
      {children}
    </div>
  );
}

export function ReviewCard({ index, q, a, onOverride }: {
  index: number; q: QuizQuestion; a?: AttemptAnswer;
  onOverride?: (status: Exclude<EvaluationStatus, "pending">) => Promise<void>;
}) {
  const [adjusting, setAdjusting] = useState(false);
  const status: EvaluationStatus = a?.evaluationStatus ?? "incorrect";
  const meta = EVAL_META[status];
  const earned = a?.pointsEarned ?? 0;
  const answered = isAnswered(q, a);
  const isChoice = q.type === "single_choice" || q.type === "multiple_choice" || q.type === "true_false";

  return (
    <article className="rounded-[24px] border border-[var(--border-subtle)] bg-card p-5 shadow-[var(--qz-shadow-card)] sm:p-6" aria-label={`Câu ${index + 1}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold tabular-nums">Câu {index + 1}</span>
          <TypeBadge type={q.type} />
        </div>
        <Badge tone={meta.tone}>
          {meta.label} · <span className="tabular-nums">{earned > 0 ? "+" : ""}{fmtPoints(earned)}/{fmtPoints(q.points)}đ</span>
        </Badge>
      </div>

      <RichTextView html={q.text} className="mt-4 !text-[17px] !font-medium !leading-7" />
      {q.imageUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={q.imageUrl} alt="Hình minh họa câu hỏi" className="mt-4 max-h-[280px] w-auto max-w-full rounded-2xl" />}

      <div className="mt-5">
        {isChoice && (
          <>
            <ChoiceList options={q.options ?? []} selectedIds={a?.selectedOptionIds ?? []} multi={q.type === "multiple_choice"} tf={q.type === "true_false"} reveal />
            {!answered && <p className="mt-3 text-[13px] font-medium text-[var(--qz-danger)]">Bạn đã bỏ trống câu này.</p>}
          </>
        )}

        {q.type === "short_answer" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Box title="Câu trả lời của bạn" tone={status === "correct" ? "success" : "danger"}>
              {answered ? <p className={cx("text-[15px] font-medium", status !== "correct" && "line-through decoration-[var(--qz-danger)]")}>{a?.textAnswer}</p> : <p className="text-[14px] text-[var(--on-surface-variant)]">Bỏ trống</p>}
            </Box>
            <Box title="Đáp án chính xác" tone="success"><p className="text-[15px] font-medium">{(q.sampleAnswer ?? "").split("|").join(" / ")}</p></Box>
          </div>
        )}

        {q.type === "essay" && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Box title="Bài viết của bạn">{answered ? <RichTextView html={a?.textAnswer} /> : <p className="text-[14px] text-[var(--on-surface-variant)]">Bỏ trống</p>}</Box>
              <Box title="Đáp án mẫu"><RichTextView html={q.sampleAnswer} /></Box>
            </div>

            {((a?.matchedPoints.length ?? 0) > 0 || (a?.missingPoints.length ?? 0) > 0) && (
              <div className="grid gap-3 md:grid-cols-2">
                {(a?.matchedPoints.length ?? 0) > 0 && (
                  <div className="rounded-2xl bg-[var(--qz-success-soft)] p-4">
                    <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--qz-success)]"><Check className="h-4 w-4" aria-hidden />Các ý bạn đã nêu đúng</p>
                    <ul className="list-disc space-y-1 pl-5 text-[14px] leading-5">{a!.matchedPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  </div>
                )}
                {(a?.missingPoints.length ?? 0) > 0 && (
                  <div className="rounded-2xl bg-[var(--qz-warning-soft)] p-4">
                    <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--qz-warning)]"><TriangleAlert className="h-4 w-4" aria-hidden />Các ý còn thiếu hoặc chưa chuẩn</p>
                    <ul className="list-disc space-y-1 pl-5 text-[14px] leading-5">{a!.missingPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  </div>
                )}
              </div>
            )}

            {a?.aiFeedback && (
              <div className="rounded-2xl border border-[var(--qz-ai)]/25 bg-[var(--qz-ai-soft)] p-4">
                <div className="flex gap-3">
                  <Sparkles className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--qz-ai)]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[var(--qz-ai)]">Nhận xét của AI</p>
                    <p className="mt-1 text-[14.5px] leading-6">{a.aiFeedback}</p>
                    {onOverride && (
                      <div className="mt-3">
                        {adjusting ? (
                          <div className="qz-anim-pop max-w-[360px]">
                            <Segmented
                              label="Tự điều chỉnh điểm" value={status === "pending" ? "incorrect" : status}
                              options={[{ value: "correct", label: "Đúng" }, { value: "partial", label: "Một phần" }, { value: "incorrect", label: "Sai" }]}
                              onChange={async (v) => { await onOverride(v as Exclude<EvaluationStatus, "pending">); setAdjusting(false); }}
                            />
                          </div>
                        ) : (
                          <Button variant="tertiary" size="sm" className="-ml-3" onClick={() => setAdjusting(true)}>Tự điều chỉnh điểm</Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!isHtmlEmpty(q.explanation) && (
        <div className="mt-5 rounded-2xl bg-[var(--qz-fill)] p-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold"><Lightbulb className="h-4 w-4" aria-hidden />Giải thích</p>
          <RichTextView html={q.explanation} className="text-[var(--on-surface-variant)]" />
        </div>
      )}
    </article>
  );
}
