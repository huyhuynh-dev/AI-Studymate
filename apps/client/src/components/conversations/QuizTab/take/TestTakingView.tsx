"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Flag, Lightbulb, X } from "lucide-react";
import type { AttemptAnswer, Quiz, QuizAttempt, QuizQuestion } from "../types";
import { Badge, Button, Modal, ProgressBar, TextInput } from "../ui/primitives";
import { RichTextInput } from "../ui/RichTextInput";
import { RichTextView } from "../ui/RichTextView";
import { ChoiceList } from "../ui/ChoiceList";
import { QUESTION_TYPE_META } from "../constants";
import { answeredCount, cx, emptyAnswer, evaluateObjective, formatClock, fmtPoints, isAnswered } from "../utils";
import { useQuizTimer } from "../hooks/useQuizTimer";
import { QuestionPalette } from "./QuestionPalette";

function PracticeFeedback({ q, a }: { q: QuizQuestion; a: AttemptAnswer }) {
  const r = evaluateObjective(q, a);
  const tone = !r ? "ai" : r.status === "correct" ? "success" : r.status === "partial" ? "warning" : "danger";
  const title = !r ? "Đối chiếu với đáp án mẫu" : r.status === "correct" ? "Chính xác" : r.status === "partial" ? "Đúng một phần" : "Chưa chính xác";
  const cls = { success: "bg-[var(--qz-success-soft)] text-[var(--qz-success)]", warning: "bg-[var(--qz-warning-soft)] text-[var(--qz-warning)]", danger: "bg-[var(--qz-danger-soft)] text-[var(--qz-danger)]", ai: "bg-[var(--qz-ai-soft)] text-[var(--qz-ai)]" }[tone];
  return (
    <div className="qz-anim-pop mt-6 rounded-2xl bg-[var(--qz-fill)] p-4" role="status">
      <p className={cx("inline-flex items-center rounded-full px-3 py-1 text-[13px] font-semibold", cls)}>{title}{r && ` · +${fmtPoints(r.earned)} điểm`}</p>
      {q.type === "short_answer" && <p className="mt-3 text-[14.5px]">Đáp án đúng: <strong>{(q.sampleAnswer ?? "").split("|").join(" / ")}</strong></p>}
      {q.type === "essay" && (
        <div className="mt-3 text-[14.5px]">
          <RichTextView html={q.sampleAnswer} />
          {q.gradingCriteria.length > 0 && <ul className="mt-3 list-disc pl-5 text-[var(--on-surface-variant)]">{q.gradingCriteria.map((c, i) => <li key={i}>{c}</li>)}</ul>}
          <p className="mt-3 text-[13px] text-[var(--on-surface-variant)]">AI sẽ chấm điểm bài viết của bạn khi nộp bài.</p>
        </div>
      )}
      {q.explanation && <div className="mt-3 border-t border-[var(--border-subtle)] pt-3"><p className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold"><Lightbulb className="h-3.5 w-3.5" aria-hidden />Giải thích</p><RichTextView html={q.explanation} className="text-[var(--on-surface-variant)]" /></div>}
    </div>
  );
}

export function TestTakingView({ quiz, attempt, onAnswer, onSubmit, onExit }: {
  quiz: Quiz; attempt: QuizAttempt;
  onAnswer: (a: AttemptAnswer) => void;
  onSubmit: (timeSpentSec: number) => void;
  onExit: (timeSpentSec: number) => void;
}) {
  const config = attempt.config;
  const mode = config?.mode ?? "exam";
  const questions = useMemo(() => {
    const order = config?.questionOrder ?? quiz.questions.map((q) => q.id);
    return order.map((id) => quiz.questions.find((q) => q.id === id)).filter(Boolean) as QuizQuestion[];
  }, [config, quiz.questions]);

  const [idx, setIdx] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  const { elapsed, remaining, getElapsed } = useQuizTimer({
    baseElapsedSec: attempt.timeSpentSec, limitSec: config?.timeLimitSec ?? null, running: true,
    onExpire: () => onSubmit(config?.timeLimitSec ?? getElapsed()),
  });

  const q = questions[idx];
  const answer = attempt.answers[q.id] ?? emptyAnswer(q.id);
  const locked = mode === "practice" && checked.has(q.id);
  const total = questions.length;
  const done = answeredCount(attempt, questions);
  const flagged = questions.filter((x) => attempt.answers[x.id]?.isFlagged).length;
  const isLast = idx === total - 1;
  const update = (patch: Partial<AttemptAnswer>) => onAnswer({ ...answer, ...patch });
  const items = questions.map((x) => ({ answered: isAnswered(x, attempt.answers[x.id]), flagged: Boolean(attempt.answers[x.id]?.isFlagged) }));

  const orderedOptions = useMemo(() => {
    const opts = q.options ?? [];
    const order = config?.optionOrder[q.id];
    return order ? (order.map((id) => opts.find((o) => o.id === id)).filter(Boolean) as typeof opts) : opts;
  }, [q, config]);

  const toggleOption = (id: string) => {
    if (locked) return;
    if (q.type === "multiple_choice")
      update({ selectedOptionIds: answer.selectedOptionIds.includes(id) ? answer.selectedOptionIds.filter((x) => x !== id) : [...answer.selectedOptionIds, id] });
    else update({ selectedOptionIds: [id] });
  };

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    cardRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [idx]);

  // Phím tắt: ← → chuyển câu, 1-8 / A-H chọn đáp án, F đánh dấu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (confirm || e.metaKey || e.ctrlKey || e.altKey || t.closest("input, textarea, select, [contenteditable='true']")) return;
      if (e.key === "ArrowRight") setIdx((i) => Math.min(total - 1, i + 1));
      else if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      else if (e.key.toLowerCase() === "f") update({ isFlagged: !answer.isFlagged });
      else if (orderedOptions.length && (q.type === "single_choice" || q.type === "multiple_choice" || q.type === "true_false")) {
        const k = e.key.toLowerCase();
        const n = /^[1-8]$/.test(k) ? Number(k) - 1 : /^[a-h]$/.test(k) ? k.charCodeAt(0) - 97 : -1;
        if (n >= 0 && orderedOptions[n]) toggleOption(orderedOptions[n].id);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // Esc: đang gõ trong ô nhập → bỏ focus; bấm lần nữa → lưu & thoát.
  const exiting = useRef(false);
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || confirm || e.defaultPrevented || exiting.current) return;
      const target = e.target as HTMLElement;
      if (target.closest?.("input, textarea, select, [contenteditable='true']")) {
        target.blur();
        return;
      }
      exiting.current = true;
      onExit(getElapsed());
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  });

  const danger = remaining != null && remaining <= 60;
  const unanswered = total - done;

  return (
    <div className="mx-auto max-w-[1080px]">
      <header className="apple-liquid-glass sticky top-0 z-30 -mx-4 mb-4 flex items-center gap-3 border-x-0! border-t-0! px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:-mx-6 sm:px-6">
        <Button variant="tertiary" size="sm" icon={<X className="h-4 w-4" />} onClick={() => onExit(getElapsed())} aria-label="Lưu và thoát">
          <span className="hidden sm:inline">Lưu & thoát</span>
          <kbd className="hidden rounded-md border border-[var(--border-outline)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--on-surface-variant)] md:inline">Esc</kbd>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
            <span className="font-semibold font-heading tabular-nums">Đã làm {done}/{total} câu</span>
            <span className={cx("font-semibold font-heading tabular-nums", danger ? "qz-anim-breathe text-[var(--qz-danger)]" : "text-[var(--on-surface-variant)]")} role={danger ? "alert" : undefined} aria-label={remaining != null ? `Còn lại ${formatClock(remaining)}` : `Đã làm ${formatClock(elapsed)}`}>
              {formatClock(remaining ?? elapsed)}
            </span>
          </div>
          <ProgressBar value={(done / total) * 100} tone={danger ? "danger" : "primary"} label="Tiến độ làm bài" />
        </div>
        <Button variant="tinted" size="sm" onClick={() => setConfirm(true)}>Nộp bài</Button>
      </header>

      <div className="lg:hidden"><QuestionPalette variant="strip" items={items} current={idx} onSelect={setIdx} /></div>

      <div className="mt-4 grid items-start gap-6 lg:mt-0 lg:grid-cols-[minmax(0,1fr)_272px]">
        <article ref={cardRef} className="scroll-mt-24 rounded-[24px] border border-[var(--border-subtle)] bg-card p-5 shadow-[var(--qz-shadow-card)] sm:p-8" aria-labelledby="qz-qtitle">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span id="qz-qtitle" className="text-[14px] font-semibold font-heading tabular-nums">Câu {idx + 1}</span>
              <Badge>{QUESTION_TYPE_META[q.type].short}</Badge>
              <Badge tone="primary"><span className="tabular-nums">{fmtPoints(q.points)}</span>&nbsp;điểm</Badge>
            </div>
            <button
              type="button" aria-pressed={answer.isFlagged} onClick={() => update({ isFlagged: !answer.isFlagged })}
              className={cx("apple-spring inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.97] sm:h-9",
                answer.isFlagged ? "bg-[var(--qz-warning-soft)] text-[var(--qz-warning)]" : "text-[var(--on-surface-variant)] hover:bg-[var(--qz-fill)]")}
            >
              <Flag className={cx("h-4 w-4", answer.isFlagged && "fill-current")} aria-hidden />
              {answer.isFlagged ? "Đã đánh dấu" : "Đánh dấu xem lại"}
            </button>
          </div>

          <RichTextView html={q.text} className="mt-5 !text-[19px] !font-medium !leading-8 tracking-[-0.01em]" />
          {q.imageUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={q.imageUrl} alt="Hình minh họa câu hỏi" className="mt-5 max-h-[360px] w-auto max-w-full rounded-2xl" />}
          {q.audioUrl && <audio controls src={q.audioUrl} className="mt-5 w-full" />}

          <div className="mt-6">
            {(q.type === "single_choice" || q.type === "multiple_choice" || q.type === "true_false") && (
              <>
                {q.type === "multiple_choice" && <p className="mb-3 text-[13px] text-[var(--on-surface-variant)]">Chọn tất cả các đáp án đúng</p>}
                <ChoiceList options={orderedOptions} selectedIds={answer.selectedOptionIds} multi={q.type === "multiple_choice"} tf={q.type === "true_false"} reveal={locked} disabled={locked} onToggle={toggleOption} />
              </>
            )}
            {q.type === "short_answer" && (
              <TextInput aria-label="Câu trả lời" placeholder="Nhập câu trả lời" className="!h-14 !text-[17px]" disabled={locked} value={answer.textAnswer} onChange={(e) => update({ textAnswer: e.target.value })} autoComplete="off" />
            )}
            {q.type === "essay" && (
              <RichTextInput key={q.id} value={answer.textAnswer} onChange={(html) => update({ textAnswer: html })} placeholder="Viết câu trả lời của bạn tại đây" minHeight={220} showWordCount disabled={locked} ariaLabel="Câu trả lời tự luận" />
            )}
          </div>

          {locked && <PracticeFeedback q={q} a={answer} />}

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-5">
            <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} disabled={idx === 0} onClick={() => setIdx(idx - 1)}><span className="hidden sm:inline">Câu trước</span></Button>
            {mode === "practice" && !locked && (
              <Button variant="tinted" icon={<Check className="h-4 w-4" />} disabled={!isAnswered(q, answer)} onClick={() => setChecked(new Set(checked).add(q.id))}>Kiểm tra câu này</Button>
            )}
            {isLast ? (
              <Button variant="primary" onClick={() => setConfirm(true)}>Nộp bài</Button>
            ) : (
              <Button variant="primary" onClick={() => setIdx(idx + 1)}><span className="sm:hidden">Tiếp</span><span className="hidden sm:inline">Câu tiếp theo</span><ArrowRight className="h-4 w-4" /></Button>
            )}
          </div>
        </article>

        <div className="hidden lg:sticky lg:top-24 lg:block"><QuestionPalette variant="grid" items={items} current={idx} onSelect={setIdx} /></div>
      </div>

      <Modal
        open={confirm} onClose={() => setConfirm(false)} size="sm" title="Nộp bài kiểm tra?"
        description={unanswered || flagged ? `Bạn còn ${unanswered ? `${unanswered} câu chưa trả lời` : ""}${unanswered && flagged ? " và " : ""}${flagged ? `${flagged} câu đánh dấu xem lại` : ""}.` : "Bạn đã trả lời tất cả các câu hỏi."}
        footer={<><Button variant="tertiary" onClick={() => setConfirm(false)}>Quay lại làm tiếp</Button><Button variant="primary" onClick={() => { setConfirm(false); onSubmit(getElapsed()); }}>Nộp bài</Button></>}
      >
        <p className="text-[14px] leading-6 text-[var(--on-surface-variant)]">Sau khi nộp, bài làm sẽ được chấm và bạn không thể chỉnh sửa lượt làm này nữa.</p>
      </Modal>
    </div>
  );
}
