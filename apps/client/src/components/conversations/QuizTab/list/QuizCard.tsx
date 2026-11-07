"use client";

import { Clock, Ellipsis, ListChecks, Pencil, Trash2, FileText } from "lucide-react";
import type { Quiz, QuizAttempt } from "../types";
import { Badge, Button, IconButton, Menu } from "../ui/primitives";
import { SourceBadge } from "../ui/badges";
import { formatDuration, toneForPct } from "../utils";
import { TONE } from "../constants";
import { quizStats, typeSummary } from "./quizStats";

const scoreText = (pct: number) => `${(pct / 10).toFixed(1).replace(".", ",")}`;

export function QuizCard({ quiz, attempts, onOpen, onStart, onEdit, onDelete }: {
  quiz: Quiz; attempts: QuizAttempt[];
  onOpen: () => void; onStart: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const s = quizStats(quiz, attempts);
  const cta = s.inProgress ? "Làm tiếp" : s.attemptCount > 0 ? "Làm lại" : "Làm bài";

  return (
    // Đồng tâm: thẻ ngoài 24px, đệm 8px → khay kết quả bên trong 16px
    <article className="apple-spring group relative flex flex-col rounded-[24px] border border-[var(--border-subtle)] bg-card p-2 shadow-[var(--qz-shadow-card)] hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--qz-shadow-hover)] motion-reduce:hover:translate-y-0">
      <div className="flex-1 px-4 pb-4 pt-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 text-[17px] font-semibold leading-6 tracking-[-0.01em] text-foreground">
            <button
              type="button"
              onClick={onOpen}
              className="text-left outline-none after:absolute after:inset-0 after:rounded-[24px] focus-visible:after:ring-2 focus-visible:after:ring-primary"
            >
              {quiz.title}
            </button>
          </h3>
          <div className="relative z-10 -mr-2 -mt-1.5">
            <Menu
              width={200}
              button={(p) => (
                <IconButton label="Tùy chọn đề" {...p}><Ellipsis className="h-5 w-5" /></IconButton>
              )}
              items={[
                { key: "edit", label: "Chỉnh sửa đề", icon: <Pencil className="h-4 w-4" />, onSelect: onEdit },
                { key: "del", label: "Xóa đề", icon: <Trash2 className="h-4 w-4" />, danger: true, onSelect: onDelete },
              ]}
            />
          </div>
        </div>
        <div className="mt-2 flex"><SourceBadge quiz={quiz} /></div>
        {quiz.description && (
          <p className="mt-3 line-clamp-2 text-[14px] leading-5 text-[var(--on-surface-variant)]">{quiz.description}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge icon={<ListChecks className="h-3 w-3" aria-hidden />}><span className="tabular-nums">{s.questionCount}</span> câu</Badge>
          <Badge icon={<Clock className="h-3 w-3" aria-hidden />}>
            {quiz.timeLimitSec ? <span className="tabular-nums">{formatDuration(quiz.timeLimitSec)}</span> : "Không giới hạn"}
          </Badge>
          <Badge icon={<FileText className="h-3 w-3" aria-hidden />}>{typeSummary(s.types)}</Badge>
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--qz-fill)] p-4">
        {s.inProgress && (
          <div className="mb-3 flex items-center gap-2">
            <Badge tone="warning">Đang làm dở</Badge>
            <span className="text-[13px] tabular-nums text-[var(--on-surface-variant)]">{s.inProgressAnswered}/{s.inProgressTotal} câu</span>
          </div>
        )}
        {s.attemptCount === 0 ? (
          !s.inProgress && <p className="text-[14px] text-[var(--on-surface-variant)]">Chưa có lượt làm bài</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {[["Cao nhất", s.bestPct!], ["Gần nhất", s.lastPct!]].map(([label, pct]) => (
              <div key={label as string}>
                <p className="text-[12px] font-semibold text-[var(--on-surface-variant)]">{label}</p>
                <p className={`mt-0.5 text-[22px] font-semibold leading-7 tabular-nums tracking-[-0.02em] ${TONE[toneForPct(pct as number)].text}`}>
                  {scoreText(pct as number)}<span className="text-[13px] font-medium text-[var(--on-surface-variant)]"> /10</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-[13px] tabular-nums text-[var(--on-surface-variant)]">
          {s.attemptCount > 0 ? `Đã làm ${s.attemptCount} lần` : "Chưa làm lần nào"}
        </span>
        <Button variant="tinted" size="sm" onClick={onStart}>{cta}</Button>
      </div>
    </article>
  );
}
