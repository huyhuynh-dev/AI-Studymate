"use client";

import { useState } from "react";
import type { DeckOption, FlashcardTarget, QuizQuestion } from "../types";
import { Button, Modal, Segmented, Select, TextInput } from "../ui/primitives";
import { cx, stripHtml } from "../utils";

export function FlashcardBridgeDialog({ quizTitle, questions, decks, onClose, onSubmit }: {
  quizTitle: string; questions: QuizQuestion[]; decks: DeckOption[]; onClose: () => void;
  onSubmit: (questionIds: string[], target: FlashcardTarget) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>(questions.map((q) => q.id));
  const [mode, setMode] = useState<"existing" | "new">(decks.length ? "existing" : "new");
  const [deckId, setDeckId] = useState(decks[0]?.id ?? "");
  const [name, setName] = useState(`Ôn lại: ${quizTitle}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const valid = selected.length > 0 && (mode === "existing" ? Boolean(deckId) : name.trim().length > 0);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await onSubmit(selected, mode === "existing" ? { deckId } : { newDeckName: name.trim() });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tạo thẻ. Vui lòng thử lại.");
    } finally { setBusy(false); }
  };

  return (
    <Modal
      open onClose={onClose} title="Chuyển thành Flashcard" description="Ôn lại các câu chưa trọn vẹn bằng lịch ôn tập ngắt quãng."
      footer={<><Button variant="tertiary" onClick={onClose} disabled={busy}>Hủy</Button><Button variant="primary" loading={busy} disabled={!valid} onClick={submit}>Tạo {selected.length} thẻ</Button></>}
    >
      <div className="flex flex-col gap-6">
        <div>
          <p className="mb-2 text-[14px] font-semibold font-heading">Lưu vào</p>
          {decks.length > 0 && <Segmented label="Nơi lưu" value={mode} onChange={setMode} options={[{ value: "existing", label: "Bộ thẻ có sẵn" }, { value: "new", label: "Bộ thẻ mới" }]} />}
          <div className="mt-3">
            {mode === "existing" ? (
              <Select aria-label="Bộ thẻ" value={deckId} onChange={(e) => setDeckId(e.target.value)}>{decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
            ) : (
              <TextInput aria-label="Tên bộ thẻ mới" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên bộ thẻ mới" />
            )}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[14px] font-semibold font-heading">Câu hỏi được chuyển <span className="font-normal tabular-nums text-[var(--on-surface-variant)]">({selected.length}/{questions.length})</span></p>
          <ul className="flex flex-col gap-1">
            {questions.map((q) => {
              const on = selected.includes(q.id);
              return (
                <li key={q.id}>
                  <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(q.id)} className="apple-spring flex min-h-11 w-full items-start gap-3 rounded-xl px-2 py-2 text-left outline-none hover:bg-[var(--qz-fill)] focus-visible:ring-2 focus-visible:ring-primary">
                    <span className={cx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px]", on ? "border-primary bg-primary text-white" : "border-[var(--border-outline)]")}>
                      {on && <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M2 6.5l2.5 2.5L10 3.5" /></svg>}
                    </span>
                    <span className="line-clamp-2 text-[14px] leading-5">{stripHtml(q.text)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        {error && <p role="alert" className="rounded-xl bg-[var(--qz-danger-soft)] px-4 py-3 text-[13px] text-[var(--qz-danger)]">{error}</p>}
      </div>
    </Modal>
  );
}
