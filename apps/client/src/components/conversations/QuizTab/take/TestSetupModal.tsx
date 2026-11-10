"use client";

import { useState } from "react";
import { Lightbulb, Timer } from "lucide-react";
import type { FeedbackMode, Quiz, TestSetup } from "../types";
import { Button, Modal, Switch, TextInput } from "../ui/primitives";
import { cx } from "../utils";

function ModeCard({ selected, onClick, icon, title, desc }: { selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button
      type="button" role="radio" aria-checked={selected} onClick={onClick}
      className={cx(
        "apple-spring flex flex-1 flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99]",
        selected ? "border-primary bg-[var(--qz-primary-soft)]" : "border-[var(--border-outline)] bg-card hover:border-primary/60",
      )}
    >
      <span className={cx("flex h-9 w-9 items-center justify-center rounded-[10px]", selected ? "bg-primary text-white" : "bg-[var(--qz-fill)] text-[var(--on-surface-variant)]")}>{icon}</span>
      <span className="text-[15px] font-semibold font-heading">{title}</span>
      <span className="text-[13px] leading-5 text-[var(--on-surface-variant)]">{desc}</span>
    </button>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <div className="min-w-0"><p className="text-[15px] font-medium font-heading">{label}</p>{hint && <p className="text-[13px] text-[var(--on-surface-variant)]">{hint}</p>}</div>
      {children}
    </div>
  );
}

export function TestSetupModal({ quiz, retryIds, onClose, onStart }: {
  quiz: Quiz; retryIds?: string[]; onClose: () => void; onStart: (setup: TestSetup) => Promise<void>;
}) {
  const [mode, setMode] = useState<FeedbackMode>("practice");
  const [timed, setTimed] = useState(Boolean(quiz.timeLimitSec));
  const [minutes, setMinutes] = useState(quiz.timeLimitSec ? Math.round(quiz.timeLimitSec / 60) : 20);
  const [shuffleQ, setShuffleQ] = useState(false);
  const [shuffleO, setShuffleO] = useState(false);
  const [busy, setBusy] = useState(false);
  const count = retryIds?.length ?? quiz.questions.length;

  const start = async () => {
    setBusy(true);
    try {
      await onStart({ mode, timeLimitSec: timed ? Math.max(1, minutes) * 60 : null, shuffleQuestions: shuffleQ, shuffleOptions: shuffleO, onlyQuestionIds: retryIds });
    } finally { setBusy(false); }
  };

  return (
    <Modal
      open onClose={onClose}
      title="Cấu hình lượt làm bài"
      description={retryIds ? `${quiz.title} · làm lại ${count} câu chưa đúng` : quiz.title}
      footer={<><Button variant="tertiary" onClick={onClose} disabled={busy}>Hủy</Button><Button variant="primary" size="lg" loading={busy} onClick={start}>Vào làm bài ngay</Button></>}
    >
      <div className="flex flex-col gap-6">
        <div role="radiogroup" aria-label="Chế độ phản hồi" className="flex flex-col gap-3 sm:flex-row">
          <ModeCard selected={mode === "practice"} onClick={() => setMode("practice")} icon={<Lightbulb className="h-5 w-5" />} title="Luyện tập" desc="Kiểm tra đáp án và xem giải thích ngay sau mỗi câu." />
          <ModeCard selected={mode === "exam"} onClick={() => setMode("exam")} icon={<Timer className="h-5 w-5" />} title="Thi thử" desc="Làm liền mạch, chỉ chấm điểm và xem lời giải sau khi nộp bài." />
        </div>

        <div className="rounded-2xl bg-[var(--qz-fill)] p-4">
          <Row label="Giới hạn thời gian" hint={timed ? undefined : "Hiển thị thời gian đã trôi qua"}>
            <Switch label="Giới hạn thời gian" checked={timed} onChange={setTimed} />
          </Row>
          {timed && (
            <div className="qz-anim-pop mt-2 flex items-center gap-3">
              <TextInput type="number" min={1} max={300} inputMode="numeric" aria-label="Số phút" className="!w-24 text-center tabular-nums" value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 1)} />
              <span className="text-[14px] text-[var(--on-surface-variant)]">phút</span>
            </div>
          )}
          <div className="my-2 h-px bg-[var(--border-subtle)]" />
          <Row label="Đảo thứ tự câu hỏi"><Switch label="Đảo thứ tự câu hỏi" checked={shuffleQ} onChange={setShuffleQ} /></Row>
          <Row label="Đảo thứ tự đáp án"><Switch label="Đảo thứ tự đáp án" checked={shuffleO} onChange={setShuffleO} /></Row>
        </div>
      </div>
    </Modal>
  );
}
