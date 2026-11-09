"use client";

import { useState } from "react";
import { Layers, PenLine, Sparkles, Minus, Plus } from "lucide-react";
import type { AIGenerateOptions, DeckGenerateOptions, DeckOption, Difficulty, DocumentOption, QuestionType, QuizSource } from "../types";
import { DocumentPicker, type DocumentSelection } from "../../FlashcardTab/ai/DocumentPicker";
import { Button, Field, Modal, Segmented, Select, ToggleChip } from "../ui/primitives";
import { DIFFICULTY_OPTIONS, QUESTION_TYPES, QUESTION_TYPE_META } from "../constants";

function Stepper({ value, onChange, min = 3, max = 30, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  const btn = "apple-spring flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--qz-fill)] text-foreground outline-none hover:bg-[var(--qz-fill-strong)] focus-visible:ring-2 focus-visible:ring-primary active:scale-95 disabled:opacity-40";
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <button type="button" className={btn} aria-label="Giảm" disabled={value <= min} onClick={() => onChange(value - 1)}><Minus className="h-4 w-4" /></button>
      <span className="w-12 text-center text-[22px] font-semibold font-heading tabular-nums tracking-[-0.02em]" aria-live="polite">{value}</span>
      <button type="button" className={btn} aria-label="Tăng" disabled={value >= max} onClick={() => onChange(value + 1)}><Plus className="h-4 w-4" /></button>
      <span className="text-[14px] text-[var(--on-surface-variant)]">câu hỏi</span>
    </div>
  );
}

function TypePicker({ value, onChange, allowed = QUESTION_TYPES }: { value: QuestionType[]; onChange: (v: QuestionType[]) => void; allowed?: QuestionType[] }) {
  const toggle = (t: QuestionType) => onChange(value.includes(t) ? (value.length > 1 ? value.filter((x) => x !== t) : value) : [...value, t]);
  return (
    <div className="flex flex-wrap gap-2">
      {allowed.map((t) => <ToggleChip key={t} selected={value.includes(t)} onClick={() => toggle(t)}>{QUESTION_TYPE_META[t].label}</ToggleChip>)}
    </div>
  );
}

const SOURCES: { key: QuizSource; icon: typeof Sparkles; title: string; desc: string; tone: string }[] = [
  { key: "ai", icon: Sparkles, title: "Từ tài liệu bằng AI", desc: "AI đọc tài liệu trong không gian học tập và soạn đề.", tone: "text-[var(--qz-ai)] bg-[var(--qz-ai-soft)]" },
  { key: "flashcard", icon: Layers, title: "Từ bộ Flashcard", desc: "Biến thẻ ghi nhớ thành câu hỏi. Nhanh, không tốn lượt AI.", tone: "text-primary bg-[var(--qz-primary-soft)]" },
  { key: "manual", icon: PenLine, title: "Tự soạn đề", desc: "Tự viết từng câu hỏi và đáp án.", tone: "text-[var(--on-surface-variant)] bg-[var(--qz-fill)]" },
];

export function CreateQuizDialog({ open, initialSource, decks, documents, onClose, onGenerateAI, onGenerateDeck, onManual }: {
  open: boolean; initialSource: QuizSource | null; decks: DeckOption[]; documents: DocumentOption[]; onClose: () => void;
  onGenerateAI: (o: AIGenerateOptions) => Promise<void>;
  onGenerateDeck: (o: DeckGenerateOptions) => Promise<void>;
  onManual: () => void;
}) {
  const [picked, setPicked] = useState<QuizSource | null>(initialSource);
  const source = initialSource ?? picked;
  const [count, setCount] = useState(10);
  const [types, setTypes] = useState<QuestionType[]>(["single_choice", "essay"]);
  const [difficulty, setDifficulty] = useState<Difficulty>("applied");
  const [deckId, setDeckId] = useState(decks[0]?.id ?? "");
  const [docIds, setDocIds] = useState<string[]>(() => documents.map((d) => d.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deck = decks.find((d) => d.id === deckId);
  const deckMax = Math.max(3, deck?.cardCount ?? 30);
  const availableDocumentIds = new Set(documents.map((document) => document.id));
  const validDocIds = docIds.filter((id) => availableDocumentIds.has(id));

  const run = async () => {
    setBusy(true); setError(null);
    try {
      if (source === "ai") await onGenerateAI({ questionCount: count, types, difficulty, documentIds: validDocIds });
      else if (source === "flashcard") await onGenerateDeck({ deckId, questionCount: Math.min(count, deckMax), types });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tạo đề. Vui lòng thử lại.");
    } finally { setBusy(false); }
  };

  // Bước 1: chọn nguồn
  if (!source || source === "manual") {
    return (
      <Modal open={open} onClose={onClose} title="Tạo đề kiểm tra" description="Chọn cách bạn muốn bắt đầu.">
        <div className="flex flex-col gap-2">
          {SOURCES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => (s.key === "manual" ? onManual() : setPicked(s.key))}
              className="apple-spring flex items-center gap-4 rounded-2xl border border-[var(--border-outline)] bg-card p-4 text-left outline-none hover:border-primary hover:bg-[var(--qz-primary-soft)] focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99]"
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.tone}`}><s.icon className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold font-heading">{s.title}</span>
                <span className="mt-0.5 block text-[13px] leading-5 text-[var(--on-surface-variant)]">{s.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </Modal>
    );
  }

  const isAI = source === "ai";
  const noDecks = !isAI && decks.length === 0;
  const noDocs = isAI && documents.length === 0;
  const noSelection = isAI && documents.length > 0 && validDocIds.length === 0;

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      dismissable={!busy}
      title={isAI ? "Tạo đề bằng AI" : "Tạo đề từ bộ Flashcard"}
      description={isAI ? "AI chỉ đọc những tài liệu bạn chọn bên dưới." : "Chọn bộ thẻ và số câu muốn trích xuất."}
      footer={
        <>
          {!initialSource && <Button variant="tertiary" disabled={busy} onClick={() => setPicked(null)}>Quay lại</Button>}
          <Button variant="primary" loading={busy} disabled={noDecks || noDocs || noSelection} icon={isAI ? <Sparkles className="h-4 w-4" /> : undefined} onClick={run}>
            {busy ? (isAI ? "Đang sinh đề…" : "Đang tạo…") : isAI ? "Bắt đầu sinh đề" : "Tạo bài kiểm tra"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {!isAI && (
          <Field label="Bộ thẻ" error={noDecks ? "Chưa có bộ Flashcard nào. Hãy tạo bộ thẻ trước." : null}>
            <Select value={deckId} onChange={(e) => setDeckId(e.target.value)} disabled={noDecks}>
              {decks.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.cardCount} thẻ)</option>)}
            </Select>
          </Field>
        )}
        {isAI && (
          noDocs ? (
            <p className="rounded-2xl bg-[var(--qz-fill)] px-4 py-4 text-[14px] leading-5 text-[var(--on-surface-variant)]">
              Chưa có tài liệu nào. Hãy tải tài liệu lên ở tab Tài liệu trước khi tạo đề bằng AI.
            </p>
          ) : (
            <>
              <DocumentPicker
                documents={documents}
                value={validDocIds}
                onChange={(selection: DocumentSelection) =>
                  setDocIds(selection === "all" ? documents.map((document) => document.id) : selection)
                }
              />
              {noSelection && <p role="alert" className="mt-1.5 text-[13px] text-[var(--qz-danger)]">Chọn ít nhất 1 tài liệu để AI soạn đề.</p>}
            </>
          )
        )}
        <div>
          <p className="mb-2 text-[14px] font-semibold">Số câu hỏi</p>
          <Stepper label="Số câu hỏi" value={Math.min(count, isAI ? 30 : deckMax)} onChange={setCount} max={isAI ? 30 : deckMax} />
        </div>
        <div>
          <p className="mb-2 text-[14px] font-semibold">Dạng câu hỏi</p>
          <TypePicker value={types} onChange={setTypes} allowed={isAI ? QUESTION_TYPES : ["single_choice", "true_false", "short_answer", "essay"]} />
        </div>
        {isAI && (
          <div>
            <p className="mb-2 text-[14px] font-semibold">Mức độ</p>
            <Segmented label="Mức độ" options={DIFFICULTY_OPTIONS} value={difficulty} onChange={setDifficulty} />
          </div>
        )}
        {error && <p role="alert" className="rounded-xl bg-[var(--qz-danger-soft)] px-4 py-3 text-[13px] text-[var(--qz-danger)]">{error}</p>}
      </div>
    </Modal>
  );
}
