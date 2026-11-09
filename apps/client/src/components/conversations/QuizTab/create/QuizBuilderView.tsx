"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import type { Quiz, QuizDraft, QuestionDraft, QuestionType } from "../types";
import { Button, Card, Field, Menu, TextInput } from "../ui/primitives";
import { QuestionEditor, newQuestion, validateQuestion, type QuestionErrors } from "./QuestionEditor";
import { QUESTION_TYPES, QUESTION_TYPE_META } from "../constants";

const toDraft = (quiz?: Quiz | null) => ({
  title: quiz?.title ?? "",
  description: quiz?.description ?? "",
  minutes: quiz?.timeLimitSec ? String(Math.round(quiz.timeLimitSec / 60)) : "",
  questions: quiz ? quiz.questions.map((q): QuestionDraft => ({ ...q, options: q.options ? q.options.map((o) => ({ ...o })) : null, gradingCriteria: [...q.gradingCriteria] })) : [newQuestion()],
});

export function QuizBuilderView({ quiz, onCancel, onSave }: {
  quiz?: Quiz | null; onCancel: () => void; onSave: (draft: QuizDraft) => Promise<void>;
}) {
  const [form, setForm] = useState(() => toDraft(quiz));
  const [errors, setErrors] = useState<Record<string, QuestionErrors>>({});
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const totalPoints = useMemo(() => form.questions.reduce((s, q) => s + q.points, 0), [form.questions]);
  const updateQ = (id: string, q: QuestionDraft) => setForm((f) => ({ ...f, questions: f.questions.map((x) => (x.id === id ? q : x)) }));
  const move = (i: number, dir: -1 | 1) =>
    setForm((f) => {
      const qs = [...f.questions];
      [qs[i], qs[i + dir]] = [qs[i + dir], qs[i]];
      return { ...f, questions: qs };
    });
  const add = (type: QuestionType) => {
    const q = newQuestion(type);
    setForm((f) => ({ ...f, questions: [...f.questions, q] }));
    setTimeout(() => document.getElementById(`qz-q-${q.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  };

  const submit = async () => {
    const errs: Record<string, QuestionErrors> = {};
    form.questions.forEach((q) => { const e = validateQuestion(q); if (Object.keys(e).length) errs[q.id] = e; });
    const tErr = form.title.trim() ? null : "Hãy đặt tên cho bài kiểm tra.";
    setErrors(errs); setTitleError(tErr); setSaveError(null);
    if (tErr || Object.keys(errs).length || form.questions.length === 0) {
      if (form.questions.length === 0) setSaveError("Đề cần có ít nhất 1 câu hỏi.");
      const firstId = form.questions.find((q) => errs[q.id])?.id;
      setTimeout(() => (tErr ? document.getElementById("qz-title") : document.getElementById(`qz-q-${firstId}`))?.scrollIntoView({ behavior: "smooth", block: "center" }), 40);
      return;
    }
    setSaving(true);
    try {
      const minutes = Number(form.minutes);
      await onSave({
        title: form.title.trim(),
        description: form.description.trim() || null,
        timeLimitSec: minutes > 0 ? Math.round(minutes * 60) : null,
        questions: form.questions.map((q) => ({
          ...q,
          options: q.options ? q.options.filter((o) => o.text.trim()) : null,
          gradingCriteria: q.gradingCriteria.map((c) => c.trim()).filter(Boolean),
        })),
      });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Không thể lưu đề. Vui lòng thử lại.");
    } finally { setSaving(false); }
  };

  const errorCount = Object.keys(errors).length;

  return (
    <div className="mx-auto max-w-[820px]">
      <div className="apple-liquid-glass sticky top-0 z-20 -mx-4 mb-6 flex items-center justify-between gap-3 border-x-0! border-t-0! px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:-mx-6 sm:px-6">
        <Button variant="tertiary" size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={onCancel}>Hủy</Button>
        <p className="truncate text-[15px] font-semibold font-heading tracking-[-0.01em]">{quiz ? "Chỉnh sửa đề" : "Soạn đề mới"}</p>
        <Button variant="primary" size="sm" loading={saving} onClick={submit}>Lưu đề</Button>
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5">
          <Field label="Tên bài kiểm tra" error={titleError}>
            <TextInput id="qz-title" invalid={Boolean(titleError)} placeholder="Ví dụ: Ôn tập chương 3" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Mô tả" hint="Không bắt buộc">
            <TextInput placeholder="Đề này kiểm tra nội dung gì?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Thời gian làm bài (phút)" hint="Để trống nếu không giới hạn" className="sm:max-w-[240px]">
            <TextInput type="number" min={1} inputMode="numeric" placeholder="Không giới hạn" className="tabular-nums" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />
          </Field>
        </div>
      </Card>

      <div className="mb-3 mt-8 flex items-baseline justify-between px-1">
        <h2 className="text-[20px] font-semibold tracking-[-0.015em]">Câu hỏi</h2>
        <p className="text-[13px] tabular-nums text-[var(--on-surface-variant)]">{form.questions.length} câu · {totalPoints} điểm</p>
      </div>

      {(errorCount > 0 || saveError) && (
        <p role="alert" className="mb-4 rounded-xl bg-[var(--qz-danger-soft)] px-4 py-3 text-[14px] text-[var(--qz-danger)]">
          {saveError ?? `Có ${errorCount} câu cần chỉnh sửa trước khi lưu.`}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {form.questions.map((q, i) => (
          <QuestionEditor
            key={q.id} index={i} total={form.questions.length} question={q} errors={errors[q.id]}
            onChange={(nq) => updateQ(q.id, nq)} onMove={(d) => move(i, d)}
            onRemove={() => setForm((f) => ({ ...f, questions: f.questions.filter((x) => x.id !== q.id) }))}
          />
        ))}
      </div>

      <div className="mt-4 pb-10">
        <Menu
          width={260}
          button={(p) => (
            <button type="button" {...p} className="apple-spring flex h-14 w-full items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-[var(--border-outline)] text-[15px] font-semibold text-primary outline-none hover:border-primary hover:bg-[var(--qz-primary-soft)] focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99]">
              <Plus className="h-5 w-5" /> Thêm câu hỏi
            </button>
          )}
          items={QUESTION_TYPES.map((t) => ({ key: t, label: QUESTION_TYPE_META[t].label, description: QUESTION_TYPE_META[t].hint, onSelect: () => add(t) }))}
        />
      </div>
    </div>
  );
}
