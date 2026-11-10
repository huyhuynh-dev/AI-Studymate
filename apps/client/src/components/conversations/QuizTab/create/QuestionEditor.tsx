"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ImagePlus, Music, Plus, Trash2, X } from "lucide-react";
import type { QuestionDraft, QuestionType, QuizOption } from "../types";
import { Button, IconButton, Select, TextInput } from "../ui/primitives";
import { RichTextInput } from "../ui/RichTextInput";
import { OPTION_LETTERS, QUESTION_TYPES, QUESTION_TYPE_META } from "../constants";
import { cx, uid } from "../utils";

export const tfOptions = (correct: boolean | null): QuizOption[] => [
  { id: "true", text: "Đúng", isCorrect: correct === true },
  { id: "false", text: "Sai", isCorrect: correct === false },
];
const blankOptions = (): QuizOption[] => Array.from({ length: 4 }, () => ({ id: uid(), text: "", isCorrect: false }));

export function newQuestion(type: QuestionType = "single_choice"): QuestionDraft {
  return {
    id: uid(), type, text: "", points: type === "essay" ? 2 : 1, gradingCriteria: [], explanation: "", sampleAnswer: "",
    options: type === "true_false" ? tfOptions(null) : type === "single_choice" || type === "multiple_choice" ? blankOptions() : null,
  };
}

/** Chuyển loại câu hỏi và giữ lại phần dữ liệu còn phù hợp */
export function changeType(q: QuestionDraft, type: QuestionType): QuestionDraft {
  if (q.type === type) return q;
  const isChoice = (t: QuestionType) => t === "single_choice" || t === "multiple_choice";
  let options = q.options ?? null;
  if (type === "true_false") options = tfOptions(null);
  else if (isChoice(type)) {
    options = isChoice(q.type) && q.options ? q.options : blankOptions();
    if (type === "single_choice") {
      let seen = false;
      options = options.map((o) => (o.isCorrect && !seen ? ((seen = true), o) : { ...o, isCorrect: false }));
    }
  } else options = null;
  return { ...q, type, options, points: type === "essay" && q.points === 1 ? 2 : q.points };
}

export type QuestionErrors = { text?: string; options?: string; answer?: string };

export function validateQuestion(q: QuestionDraft): QuestionErrors {
  const e: QuestionErrors = {};
  const plain = q.text.replace(/<[^>]*>/g, "").trim();
  if (!plain) e.text = "Hãy nhập nội dung câu hỏi.";
  if (q.type === "single_choice" || q.type === "multiple_choice") {
    const filled = (q.options ?? []).filter((o) => o.text.trim());
    const correct = filled.filter((o) => o.isCorrect).length;
    if (filled.length < 2) e.options = "Cần ít nhất 2 lựa chọn có nội dung.";
    else if (correct === 0) e.options = "Hãy đánh dấu đáp án đúng.";
    else if (q.type === "single_choice" && correct > 1) e.options = "Câu 1 đáp án chỉ được có 1 lựa chọn đúng.";
  } else if (q.type === "true_false") {
    if (!(q.options ?? []).some((o) => o.isCorrect)) e.options = "Hãy chọn đáp án chuẩn: Đúng hoặc Sai.";
  } else if (q.type === "short_answer") {
    if (!(q.sampleAnswer ?? "").trim()) e.answer = "Hãy nhập đáp án chính xác.";
  } else if (q.type === "essay") {
    if (!(q.sampleAnswer ?? "").replace(/<[^>]*>/g, "").trim() && q.gradingCriteria.filter((c) => c.trim()).length === 0)
      e.answer = "Cần có bài viết mẫu hoặc ít nhất 1 ý chính để AI chấm.";
  }
  return e;
}

export function QuestionEditor({ index, total, question, errors, onChange, onRemove, onMove }: {
  index: number; total: number; question: QuestionDraft; errors?: QuestionErrors;
  onChange: (q: QuestionDraft) => void; onRemove: () => void; onMove: (dir: -1 | 1) => void;
}) {
  const q = question;
  const [showMedia, setShowMedia] = useState(Boolean(q.imageUrl || q.audioUrl));
  const [showExplain, setShowExplain] = useState(Boolean(q.explanation && q.explanation.replace(/<[^>]*>/g, "").trim()));
  const set = (patch: Partial<QuestionDraft>) => onChange({ ...q, ...patch });
  const isMulti = q.type === "multiple_choice";
  const options = q.options ?? [];

  const setOption = (id: string, patch: Partial<QuizOption>) =>
    set({ options: options.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  const markCorrect = (id: string) =>
    set({ options: options.map((o) => (isMulti ? (o.id === id ? { ...o, isCorrect: !o.isCorrect } : o) : { ...o, isCorrect: o.id === id })) });

  return (
    <section id={`qz-q-${q.id}`} aria-label={`Câu hỏi ${index + 1}`} className="rounded-[24px] border border-[var(--border-subtle)] bg-card p-5 shadow-[var(--qz-shadow-card)] sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--qz-primary-soft)] text-[15px] font-semibold tabular-nums text-primary">{index + 1}</span>
        <Select aria-label="Loại câu hỏi" className="!h-11 min-w-0 flex-1 sm:max-w-[240px]" value={q.type} onChange={(e) => onChange(changeType(q, e.target.value as QuestionType))}>
          {QUESTION_TYPES.map((t) => <option key={t} value={t}>{QUESTION_TYPE_META[t].label}</option>)}
        </Select>
        <label className="ml-auto flex items-center gap-2 text-[13px] font-semibold text-[var(--on-surface-variant)]">
          Điểm
          <TextInput
            type="number" min={0.5} step={0.5} inputMode="decimal" aria-label="Điểm của câu"
            className="!h-11 !w-[72px] !px-3 text-center tabular-nums"
            value={q.points}
            onChange={(e) => set({ points: Math.max(0.5, Number(e.target.value) || 1) })}
          />
        </label>
        <div className="flex items-center">
          <IconButton label="Chuyển câu lên" disabled={index === 0} onClick={() => onMove(-1)}><ChevronUp className="h-5 w-5" /></IconButton>
          <IconButton label="Chuyển câu xuống" disabled={index === total - 1} onClick={() => onMove(1)}><ChevronDown className="h-5 w-5" /></IconButton>
          <IconButton label="Xóa câu hỏi" tone="danger" onClick={onRemove}><Trash2 className="h-[18px] w-[18px]" /></IconButton>
        </div>
      </div>

      <div className="mt-5">
        <RichTextInput
          key={`${q.id}-text`} value={q.text} onChange={(html) => set({ text: html })} toolbar="compact"
          placeholder="Nhập nội dung câu hỏi" minHeight={72} invalid={Boolean(errors?.text)} ariaLabel={`Nội dung câu ${index + 1}`}
        />
        {errors?.text && <p role="alert" className="mt-1.5 text-[13px] text-[var(--qz-danger)]">{errors.text}</p>}
        <div className="mt-2 flex flex-wrap gap-1">
          <Button variant="tertiary" size="sm" icon={<ImagePlus className="h-4 w-4" />} onClick={() => setShowMedia((s) => !s)}>
            {showMedia ? "Ẩn ảnh / âm thanh" : "Thêm ảnh / âm thanh"}
          </Button>
        </div>
        {showMedia && (
          <div className="qz-anim-pop mt-2 grid gap-3 sm:grid-cols-2">
            <div className="relative">
              <ImagePlus className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--on-surface-variant)]" aria-hidden />
              <TextInput aria-label="Đường dẫn hình ảnh" placeholder="Đường dẫn hình ảnh (URL)" className="pl-10" value={q.imageUrl ?? ""} onChange={(e) => set({ imageUrl: e.target.value })} />
            </div>
            <div className="relative">
              <Music className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--on-surface-variant)]" aria-hidden />
              <TextInput aria-label="Đường dẫn âm thanh" placeholder="Đường dẫn âm thanh (URL)" className="pl-10" value={q.audioUrl ?? ""} onChange={(e) => set({ audioUrl: e.target.value })} />
            </div>
          </div>
        )}
      </div>

      {/* Vùng đáp án — thay đổi theo loại câu */}
      <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
        {(q.type === "single_choice" || q.type === "multiple_choice") && (
          <div>
            <p className="mb-3 text-[13px] text-[var(--on-surface-variant)]">{isMulti ? "Tích vào tất cả đáp án đúng" : "Chọn 1 đáp án đúng"}</p>
            <ul className="flex flex-col gap-2">
              {options.map((o, i) => (
                <li key={o.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    role={isMulti ? "checkbox" : "radio"}
                    aria-checked={o.isCorrect}
                    aria-label={`Đánh dấu lựa chọn ${OPTION_LETTERS[i]} là đáp án đúng`}
                    onClick={() => markCorrect(o.id)}
                    className="apple-spring flex h-11 w-11 shrink-0 items-center justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
                  >
                    <span className={cx(
                      "flex h-[22px] w-[22px] items-center justify-center border-2 text-white",
                      isMulti ? "rounded-md" : "rounded-full",
                      o.isCorrect ? "border-[var(--qz-success)] bg-[var(--qz-success)]" : "border-[var(--border-outline)]",
                    )}>
                      {o.isCorrect && <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M2 6.5l2.5 2.5L10 3.5" /></svg>}
                    </span>
                  </button>
                  <span className="w-5 shrink-0 text-center text-[13px] font-semibold text-[var(--on-surface-variant)]">{OPTION_LETTERS[i]}</span>
                  <TextInput aria-label={`Lựa chọn ${OPTION_LETTERS[i]}`} placeholder={`Lựa chọn ${OPTION_LETTERS[i]}`} value={o.text} onChange={(e) => setOption(o.id, { text: e.target.value })} />
                  <IconButton label="Xóa lựa chọn" tone="danger" disabled={options.length <= 2} onClick={() => set({ options: options.filter((x) => x.id !== o.id) })}><X className="h-4 w-4" /></IconButton>
                </li>
              ))}
            </ul>
            {options.length < 8 && (
              <Button variant="tertiary" size="sm" className="mt-2" icon={<Plus className="h-4 w-4" />} onClick={() => set({ options: [...options, { id: uid(), text: "", isCorrect: false }] })}>
                Thêm lựa chọn
              </Button>
            )}
            {errors?.options && <p role="alert" className="mt-2 text-[13px] text-[var(--qz-danger)]">{errors.options}</p>}
          </div>
        )}

        {q.type === "true_false" && (
          <div>
            <p className="mb-3 text-[13px] text-[var(--on-surface-variant)]">Đáp án chuẩn của mệnh đề trên là</p>
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Đáp án chuẩn">
              {options.map((o) => (
                <button
                  key={o.id} type="button" role="radio" aria-checked={o.isCorrect}
                  onClick={() => set({ options: options.map((x) => ({ ...x, isCorrect: x.id === o.id })) })}
                  className={cx(
                    "apple-spring h-14 rounded-2xl border-2 text-[16px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98]",
                    o.isCorrect ? "border-primary bg-[var(--qz-primary-soft)] text-primary" : "border-[var(--border-outline)] text-[var(--on-surface-variant)] hover:border-primary",
                  )}
                >
                  {o.text}
                </button>
              ))}
            </div>
            {errors?.options && <p role="alert" className="mt-2 text-[13px] text-[var(--qz-danger)]">{errors.options}</p>}
          </div>
        )}

        {q.type === "short_answer" && (
          <div>
            <label className="mb-2 block text-[14px] font-semibold" htmlFor={`sa-${q.id}`}>Đáp án chính xác</label>
            <TextInput id={`sa-${q.id}`} invalid={Boolean(errors?.answer)} placeholder="Ví dụ: SM-2" value={q.sampleAnswer ?? ""} onChange={(e) => set({ sampleAnswer: e.target.value })} />
            <p className="mt-1.5 text-[13px] text-[var(--on-surface-variant)]">Có nhiều cách viết đúng? Ngăn cách bằng dấu “|”, ví dụ: SM-2|SM2.</p>
            {errors?.answer && <p role="alert" className="mt-1.5 text-[13px] text-[var(--qz-danger)]">{errors.answer}</p>}
          </div>
        )}

        {q.type === "essay" && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-2 text-[14px] font-semibold">Bài viết mẫu</p>
              <RichTextInput key={`${q.id}-sample`} value={q.sampleAnswer ?? ""} onChange={(html) => set({ sampleAnswer: html })} placeholder="Bài viết mẫu hoàn chỉnh để người học đối chiếu" minHeight={110} invalid={Boolean(errors?.answer)} ariaLabel="Bài viết mẫu" />
            </div>
            <div>
              <p className="mb-1 text-[14px] font-semibold">Các ý chính cần đạt</p>
              <p className="mb-3 text-[13px] text-[var(--on-surface-variant)]">AI bám theo từng ý này khi chấm và nhận xét.</p>
              <ul className="flex flex-col gap-2">
                {q.gradingCriteria.map((c, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <TextInput aria-label={`Ý chính ${i + 1}`} placeholder={`Ý chính ${i + 1}`} value={c} onChange={(e) => set({ gradingCriteria: q.gradingCriteria.map((x, j) => (j === i ? e.target.value : x)) })} />
                    <IconButton label="Xóa ý chính" tone="danger" onClick={() => set({ gradingCriteria: q.gradingCriteria.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></IconButton>
                  </li>
                ))}
              </ul>
              <Button variant="tertiary" size="sm" className="mt-2" icon={<Plus className="h-4 w-4" />} onClick={() => set({ gradingCriteria: [...q.gradingCriteria, ""] })}>Thêm ý chính</Button>
            </div>
            {errors?.answer && <p role="alert" className="text-[13px] text-[var(--qz-danger)]">{errors.answer}</p>}
          </div>
        )}
      </div>

      <div className="mt-5">
        <button
          type="button" aria-expanded={showExplain} onClick={() => setShowExplain((s) => !s)}
          className="apple-spring inline-flex h-9 items-center gap-1.5 rounded-lg px-1 text-[14px] font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronDown className={cx("h-4 w-4 apple-spring", showExplain && "rotate-180")} aria-hidden />
          Giải thích đáp án
        </button>
        {showExplain && (
          <div className="qz-anim-pop mt-2">
            <RichTextInput key={`${q.id}-exp`} value={q.explanation ?? ""} onChange={(html) => set({ explanation: html })} toolbar="compact" placeholder="Hiển thị cho người học sau khi nộp bài" minHeight={72} ariaLabel="Giải thích đáp án" />
          </div>
        )}
      </div>
    </section>
  );
}
