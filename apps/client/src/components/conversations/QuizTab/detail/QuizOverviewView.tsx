"use client";

import { useState } from "react";
import { ArrowLeft, ChevronDown, Clock, Lock, Pencil, Play, Trash2, Trophy } from "lucide-react";
import type { Quiz, QuizAttempt } from "../types";
import { Badge, Button, Card } from "../ui/primitives";
import { SourceBadge, TypeBadge } from "../ui/badges";
import { RichTextView } from "../ui/RichTextView";
import { cx, formatDateTime, formatDuration, fmtPoints, stripHtml, toPct, toScale10, toneForPct } from "../utils";
import { TONE } from "../constants";
import { quizStats } from "../list/quizStats";
import { ProgressChart } from "./ProgressChart";

export function QuizOverviewView({ quiz, attempts, onBack, onEdit, onDelete, onStart, onReview, onResume }: {
  quiz: Quiz; attempts: QuizAttempt[];
  onBack: () => void; onEdit: () => void; onDelete: () => void; onStart: () => void;
  onReview: (a: QuizAttempt) => void; onResume: (a: QuizAttempt) => void;
}) {
  const s = quizStats(quiz, attempts);
  const [showQuestions, setShowQuestions] = useState(false);
  const rows = attempts.map((a, i) => ({ a, n: attempts.length - i }));

  return (
    <div className="mx-auto max-w-[960px]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="tertiary" size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={onBack}>Danh sách đề</Button>
        <div className="flex items-center">
          <Button variant="tertiary" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={onEdit}><span className="hidden sm:inline">Chỉnh sửa câu hỏi</span><span className="sm:hidden">Sửa</span></Button>
          <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={onDelete}><span className="hidden sm:inline">Xóa đề</span><span className="sm:hidden">Xóa</span></Button>
        </div>
      </div>

      <Card className="p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <SourceBadge quiz={quiz} />
            <h1 className="mt-3 text-[28px] font-semibold leading-9 tracking-[-0.025em] sm:text-[32px] sm:leading-10">{quiz.title}</h1>
            {quiz.description && <p className="mt-2 max-w-[560px] text-[15px] leading-6 text-[var(--on-surface-variant)]">{quiz.description}</p>}
            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
              {[
                ["Số câu", `${s.questionCount}`],
                ["Điểm tối đa", fmtPoints(s.totalPoints)],
                ["Thời gian", quiz.timeLimitSec ? formatDuration(quiz.timeLimitSec) : "Không giới hạn"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[12px] font-semibold text-[var(--on-surface-variant)]">{k}</dt>
                  <dd className="mt-0.5 text-[17px] font-semibold tabular-nums tracking-[-0.01em]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <Button variant="primary" size="lg" icon={<Play className="h-4 w-4" />} className="sm:shrink-0" onClick={s.inProgress ? () => onResume(s.inProgress!) : onStart}>
            {s.inProgress ? "Làm tiếp" : s.attemptCount > 0 ? "Làm lại" : "Bắt đầu làm bài"}
          </Button>
        </div>
      </Card>

      <section className="mt-8" aria-labelledby="qz-hist">
        <h2 id="qz-hist" className="mb-3 px-1 text-[20px] font-semibold tracking-[-0.015em]">Tiến bộ của bạn</h2>
        {attempts.length === 0 ? (
          <Card className="px-6 py-10 text-center">
            <Trophy className="mx-auto h-8 w-8 text-[var(--on-surface-variant)]" aria-hidden />
            <p className="mt-3 text-[15px] font-semibold">Chưa có lượt làm bài nào</p>
            <p className="mx-auto mt-1 max-w-[360px] text-[14px] text-[var(--on-surface-variant)]">Làm xong lượt đầu tiên, biểu đồ tiến bộ sẽ xuất hiện ở đây.</p>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <Card className="p-5">
              {s.attemptCount > 0 ? <ProgressChart attempts={attempts} /> : <p className="py-12 text-center text-[14px] text-[var(--on-surface-variant)]">Chưa có lượt nào hoàn thành.</p>}
            </Card>
            <Card className="overflow-hidden p-2">
              <ul className="divide-y divide-[var(--border-subtle)]">
                {rows.map(({ a, n }) => {
                  const done = a.status === "submitted";
                  const pct = toPct(a.score, a.maxScore);
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-[15px] font-semibold">Lần {n}{!done && <Badge tone="warning">Đang làm dở</Badge>}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] tabular-nums text-[var(--on-surface-variant)]">
                          <span>{formatDateTime(a.startedAt)}</span>
                          <Clock className="h-3 w-3" aria-hidden /><span>{formatDuration(a.timeSpentSec)}</span>
                        </p>
                      </div>
                      {done && (
                        <p className={cx("text-right text-[18px] font-semibold tabular-nums tracking-[-0.02em]", TONE[toneForPct(pct)].text)}>
                          {String(toScale10(a.score, a.maxScore)).replace(".", ",")}<span className="text-[12px] font-medium text-[var(--on-surface-variant)]"> /10</span>
                        </p>
                      )}
                      <Button variant="tertiary" size="sm" onClick={() => (done ? onReview(a) : onResume(a))}>{done ? "Xem lại" : "Tiếp tục"}</Button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        )}
      </section>

      <section className="mt-8 pb-10">
        <button
          type="button" aria-expanded={showQuestions} onClick={() => setShowQuestions((v) => !v)}
          className="apple-spring flex min-h-11 w-full items-center justify-between rounded-2xl px-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="text-[20px] font-semibold tracking-[-0.015em]">Xem trước câu hỏi <span className="text-[15px] font-medium tabular-nums text-[var(--on-surface-variant)]">({s.questionCount})</span></span>
          <ChevronDown className={cx("apple-spring h-5 w-5 text-[var(--on-surface-variant)]", showQuestions && "rotate-180")} aria-hidden />
        </button>
        {showQuestions && (
          <Card className="qz-anim-pop mt-3 p-2">
            <p className="flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--on-surface-variant)]"><Lock className="h-3.5 w-3.5" aria-hidden />Đáp án và lời giải được ẩn để bạn không bị lộ đề.</p>
            <ol className="divide-y divide-[var(--border-subtle)]">
              {quiz.questions.map((q, i) => (
                <li key={q.id} className="flex items-start gap-3 px-3 py-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--qz-fill)] text-[13px] font-semibold tabular-nums">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-[14.5px] leading-6" title={stripHtml(q.text)}><RichTextView html={q.text} className="!text-[14.5px] [&_p]:inline" /></div>
                    <div className="mt-1.5 flex gap-2"><TypeBadge type={q.type} /><Badge tone="neutral"><span className="tabular-nums">{fmtPoints(q.points)}</span> điểm</Badge></div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </section>
    </div>
  );
}
