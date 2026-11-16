"use client";

import { useState } from "react";
import { Layers, PenLine, Sparkles, Target, Minus, Plus } from "lucide-react";
import type {
  AIGenerateOptions,
  BloomLevel,
  BloomPreset,
  DeckGenerateOptions,
  DeckOption,
  Difficulty,
  DocumentOption,
  QuestionType,
  QuizCreateMode,
  TargetedQuizOptions,
  WeakAreasSummary,
} from "../types";
import { DocumentPicker, type DocumentSelection } from "../../FlashcardTab/ai/DocumentPicker";
import { Button, Field, Modal, Segmented, Select, ToggleChip } from "../ui/primitives";
import {
  BLOOM_LEVELS,
  BLOOM_META,
  BLOOM_PRESET_OPTIONS,
  DIFFICULTY_OPTIONS,
  QUESTION_TYPES,
  QUESTION_TYPE_META,
} from "../constants";

function computePreviewCounts(
  total: number,
  weights: Record<BloomLevel, number>
): Record<BloomLevel, number> {
  const safeTotal = Math.max(1, total);
  const sum = BLOOM_LEVELS.reduce((acc, lvl) => acc + Math.max(0, weights[lvl] ?? 0), 0);
  if (sum <= 0) {
    return { remember: 0, understand: safeTotal, apply: 0, analyze: 0 };
  }
  const exact = BLOOM_LEVELS.map((lvl) => {
    const raw = (safeTotal * Math.max(0, weights[lvl] ?? 0)) / sum;
    return { lvl, floor: Math.floor(raw), rem: raw - Math.floor(raw) };
  });
  let assigned = exact.reduce((acc, x) => acc + x.floor, 0);
  const out: Record<BloomLevel, number> = { remember: 0, understand: 0, apply: 0, analyze: 0 };
  for (const x of exact) out[x.lvl] = x.floor;
  const sorted = [...exact].sort((a, b) => b.rem - a.rem);
  for (let i = 0; assigned < safeTotal && i < sorted.length; i += 1) {
    out[sorted[i].lvl] += 1;
    assigned += 1;
  }
  return out;
}

function BloomConfigSection({
  preset,
  onPresetChange,
  customWeights,
  onCustomChange,
  questionCount,
  allowCustom,
}: {
  preset: BloomPreset;
  onPresetChange: (p: BloomPreset) => void;
  customWeights: Record<BloomLevel, number>;
  onCustomChange: (w: Record<BloomLevel, number>) => void;
  questionCount: number;
  allowCustom: boolean;
}) {
  const options = allowCustom
    ? BLOOM_PRESET_OPTIONS
    : BLOOM_PRESET_OPTIONS.filter((o) => o.value !== "custom");
  const activeOption = options.find((o) => o.value === preset) ?? options[1];
  const effectiveWeights =
    preset === "custom" && allowCustom ? customWeights : activeOption.weights;
  const totalCustomWeight = BLOOM_LEVELS.reduce(
    (sum, lvl) => sum + Math.max(0, customWeights[lvl] ?? 0),
    0
  );
  const preview = computePreviewCounts(questionCount, effectiveWeights);

  return (
    <div>
      <p className="mb-2 text-[14px] font-semibold">Phân bổ tư duy Bloom</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((opt) => {
          const selected = preset === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onPresetChange(opt.value)}
              className={`apple-spring rounded-xl border p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                selected
                  ? "border-primary bg-[var(--qz-primary-soft)]"
                  : "border-[var(--border-outline)] bg-card hover:border-primary/60"
              }`}
            >
              <span className="block text-[13.5px] font-semibold font-heading text-foreground">
                {opt.label}
              </span>
              <span className="mt-0.5 block text-[12px] leading-4 text-[var(--on-surface-variant)]">
                {opt.description}
              </span>
            </button>
          );
        })}
      </div>

      {preset === "custom" && allowCustom && (
        <div className="mt-3 space-y-2.5 rounded-2xl border border-[var(--border-outline)] bg-[var(--qz-fill)] p-3.5">
          {BLOOM_LEVELS.map((lvl) => (
            <div key={lvl} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-[12.5px] font-medium text-foreground">
                {BLOOM_META[lvl].short}
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={customWeights[lvl]}
                aria-label={BLOOM_META[lvl].label}
                onChange={(e) =>
                  onCustomChange({
                    ...customWeights,
                    [lvl]: Number(e.target.value),
                  })
                }
                className="h-1.5 flex-1 cursor-pointer accent-primary"
              />
              <span className="w-16 shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-[var(--on-surface-variant)]">
                {customWeights[lvl]}% ({preview[lvl]}c)
              </span>
            </div>
          ))}
          {totalCustomWeight <= 0 && (
            <p role="alert" className="text-[12.5px] text-[var(--qz-danger)]">
              Tổng tỷ lệ Bloom phải lớn hơn 0%.
            </p>
          )}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--on-surface-variant)]">
        <span className="font-medium">Dự kiến:</span>
        {BLOOM_LEVELS.filter((lvl) => preview[lvl] > 0).map((lvl) => (
          <span
            key={lvl}
            className="rounded-full bg-[var(--qz-fill)] px-2.5 py-0.5 font-medium tabular-nums text-foreground"
          >
            {BLOOM_META[lvl].short}: {preview[lvl]}
          </span>
        ))}
      </div>
    </div>
  );
}

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

const SOURCES: { key: QuizCreateMode; icon: typeof Sparkles; title: string; desc: string; tone: string }[] = [
  { key: "ai", icon: Sparkles, title: "Từ tài liệu bằng AI", desc: "AI đọc tài liệu trong không gian học tập và soạn đề.", tone: "text-[var(--qz-ai)] bg-[var(--qz-ai-soft)]" },
  { key: "targeted", icon: Target, title: "Ôn tập bù lỗ hổng (AI Đặc trị)", desc: "AI tập trung vào câu hỏi bạn hay sai và thẻ Flashcard khó nhớ.", tone: "text-[var(--qz-danger)] bg-[var(--qz-danger-soft)]" },
  { key: "flashcard", icon: Layers, title: "Từ bộ Flashcard", desc: "Biến thẻ ghi nhớ thành câu hỏi. Nhanh, không tốn lượt AI.", tone: "text-primary bg-[var(--qz-primary-soft)]" },
  { key: "manual", icon: PenLine, title: "Tự soạn đề", desc: "Tự viết từng câu hỏi và đáp án.", tone: "text-[var(--on-surface-variant)] bg-[var(--qz-fill)]" },
];

export function CreateQuizDialog({ open, initialSource, decks, documents, weakSummary, targetedChunkIds, targetedSectionTitle, initialBloomPreset, onClose, onGenerateAI, onGenerateDeck, onGenerateTargeted, onManual }: {
  open: boolean; initialSource: QuizCreateMode | null; decks: DeckOption[]; documents: DocumentOption[]; weakSummary?: WeakAreasSummary | null;
  targetedChunkIds?: string[]; targetedSectionTitle?: string; initialBloomPreset?: BloomPreset; onClose: () => void;
  onGenerateAI: (o: AIGenerateOptions) => Promise<void>;
  onGenerateDeck: (o: DeckGenerateOptions) => Promise<void>;
  onGenerateTargeted?: (o: TargetedQuizOptions) => Promise<void>;
  onManual: () => void;
}) {
  const [picked, setPicked] = useState<QuizCreateMode | null>(initialSource);
  const source = initialSource ?? picked;
  const [count, setCount] = useState(10);
  const [types, setTypes] = useState<QuestionType[]>(() =>
    initialSource === "flashcard"
      ? ["single_choice", "true_false", "short_answer"]
      : ["single_choice", "essay"]
  );
  const [difficulty, setDifficulty] = useState<Difficulty>("applied");
  const [bloomPreset, setBloomPreset] = useState<BloomPreset>(() => initialBloomPreset ?? "balanced");
  const [customWeights, setCustomWeights] = useState<Record<BloomLevel, number>>({
    remember: 25,
    understand: 30,
    apply: 30,
    analyze: 15,
  });
  const [deckId, setDeckId] = useState(decks[0]?.id ?? "");
  const [docIds, setDocIds] = useState<string[]>(() => documents.map((d) => d.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deck = decks.find((d) => d.id === deckId);
  const deckMax = Math.max(3, deck?.cardCount ?? 30);
  const availableDocumentIds = new Set(documents.map((document) => document.id));
  const validDocIds = docIds.filter((id) => availableDocumentIds.has(id));
  const customTotalWeight = BLOOM_LEVELS.reduce(
    (sum, lvl) => sum + Math.max(0, customWeights[lvl] ?? 0),
    0
  );

  const run = async () => {
    setBusy(true); setError(null);
    try {
      if (source === "ai") {
        await onGenerateAI({
          questionCount: count,
          types,
          difficulty,
          documentIds: validDocIds,
          bloomPreset,
          ...(bloomPreset === "custom" ? { bloomDistribution: customWeights } : {}),
        });
      } else if (source === "targeted") {
        await onGenerateTargeted?.({
          questionCount: Math.min(Math.max(count, 3), 15),
          types,
          bloomPreset: bloomPreset === "custom" ? "balanced" : bloomPreset,
          ...(Array.isArray(targetedChunkIds) && targetedChunkIds.length > 0
            ? { chunkIds: targetedChunkIds }
            : {}),
        });
      } else if (source === "flashcard") {
        const allowedTypes = types.filter((t) => ["single_choice", "true_false", "short_answer"].includes(t));
        await onGenerateDeck({
          deckId,
          questionCount: Math.min(count, deckMax),
          types: allowedTypes.length > 0 ? allowedTypes : ["single_choice", "true_false", "short_answer"],
        });
      }
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
              onClick={() => {
                if (s.key === "manual") {
                  onManual();
                } else {
                  if (s.key === "flashcard") {
                    setTypes(["single_choice", "true_false", "short_answer"]);
                  }
                  setPicked(s.key);
                }
              }}
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
  const isTargeted = source === "targeted";
  const isDeck = source === "flashcard";
  const hasExplicitChunks = Array.isArray(targetedChunkIds) && targetedChunkIds.length > 0;
  const noDecks = isDeck && decks.length === 0;
  const noDocs = isAI && documents.length === 0;
  const noSelection = isAI && documents.length > 0 && validDocIds.length === 0;
  const noWeakAreas = isTargeted && !hasExplicitChunks && (!weakSummary || !weakSummary.hasWeakAreas);
  const invalidCustomBloom = isAI && bloomPreset === "custom" && customTotalWeight <= 0;
  const effectiveMax = isTargeted ? 15 : isAI ? 30 : deckMax;
  const effectiveCount = Math.min(Math.max(count, 3), effectiveMax);

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      dismissable={!busy}
      title={isTargeted ? "Tạo đề ôn tập bù lỗ hổng" : isAI ? "Tạo đề bằng AI" : "Tạo đề từ bộ Flashcard"}
      description={
        isTargeted
          ? "AI phân tích các phần kiến thức bạn từng sai hoặc dễ quên để tạo đề luyện lại hoàn toàn mới."
          : isAI
            ? "AI chỉ đọc những tài liệu bạn chọn bên dưới."
            : "Chọn bộ thẻ và số câu muốn trích xuất."
      }
      footer={
        <>
          {!initialSource && <Button variant="tertiary" disabled={busy} onClick={() => setPicked(null)}>Quay lại</Button>}
          <Button
            variant="primary"
            loading={busy}
            disabled={noDecks || noDocs || noSelection || noWeakAreas || invalidCustomBloom}
            icon={isTargeted ? <Target className="h-4 w-4" /> : isAI ? <Sparkles className="h-4 w-4" /> : undefined}
            onClick={run}
          >
            {busy ? (isAI || isTargeted ? "Đang sinh đề…" : "Đang tạo…") : isTargeted ? "Tạo đề đặc trị" : isAI ? "Bắt đầu sinh đề" : "Tạo bài kiểm tra"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {isDeck && (
          <Field label="Bộ thẻ" error={noDecks ? "Chưa có bộ Flashcard nào. Hãy tạo bộ thẻ trước." : null}>
            <Select value={deckId} onChange={(e) => setDeckId(e.target.value)} disabled={noDecks}>
              {decks.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.cardCount} thẻ)</option>)}
            </Select>
          </Field>
        )}
        {isTargeted && (
          hasExplicitChunks ? (
            <div className="rounded-2xl border border-[var(--border-outline)] bg-[var(--qz-ai-soft)] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[14px] font-semibold font-heading text-foreground">
                  {targetedSectionTitle
                    ? `Mục tiêu: ${targetedSectionTitle}`
                    : "Đề đặc trị theo vùng kiến thức đã chọn"}
                </p>
                <span className="shrink-0 rounded-full bg-[var(--qz-elevated)] px-2.5 py-0.5 text-[12px] font-semibold tabular-nums text-foreground">
                  {targetedChunkIds.length} đoạn nguồn
                </span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-5 text-[var(--on-surface-variant)]">
                AI sẽ mở rộng ngữ cảnh liền kề quanh các đoạn văn của mục này và sinh câu hỏi mới giúp củng cố kiến thức.
              </p>
            </div>
          ) : noWeakAreas ? (
            <div className="rounded-2xl border border-[var(--border-outline)] bg-[var(--qz-fill)] px-4 py-4 text-[14px] leading-5 text-[var(--on-surface-variant)]">
              Chưa phát hiện lỗ hổng kiến thức nào. Hãy làm ít nhất 1 bài kiểm tra hoặc ôn tập Flashcard trước để hệ thống xác định vùng kiến thức yếu.
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--border-outline)] bg-[var(--qz-ai-soft)] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[14px] font-semibold font-heading text-foreground">
                  {weakSummary?.weakChunkCount ?? 0} vùng kiến thức yếu được phát hiện
                </p>
                <span className="text-[12.5px] font-medium text-[var(--on-surface-variant)]">
                  {weakSummary?.incorrectQuizCount ?? 0} câu sai · {weakSummary?.leechCardCount ?? 0} thẻ khó
                </span>
              </div>
              {weakSummary && weakSummary.topWeakTopics.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {weakSummary.topWeakTopics.map((topic) => (
                    <span
                      key={topic}
                      className="rounded-full bg-[var(--qz-elevated)] px-2.5 py-0.5 text-[12px] font-medium text-foreground"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}
              {weakSummary && weakSummary.topMissingPoints.length > 0 && (
                <ul className="mt-2.5 list-disc space-y-1 pl-4 text-[12.5px] text-[var(--on-surface-variant)]">
                  {weakSummary.topMissingPoints.slice(0, 3).map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              )}
            </div>
          )
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
          <Stepper label="Số câu hỏi" value={effectiveCount} onChange={setCount} max={effectiveMax} />
        </div>
        <div>
          <p className="mb-2 text-[14px] font-semibold">Dạng câu hỏi</p>
          <TypePicker
            value={types}
            onChange={setTypes}
            allowed={
              isAI || isTargeted
                ? QUESTION_TYPES
                : [
                    "single_choice",
                    "true_false",
                    "short_answer",
                    // "multiple_choice", // Tạm thời comment out theo chiến lược Rule-based (FromFlashcard2Deck)
                    // "essay", // Tạm thời comment out theo chiến lược Rule-based (FromFlashcard2Deck)
                  ]
            }
          />
        </div>
        {isAI && (
          <div>
            <p className="mb-2 text-[14px] font-semibold">Mức độ</p>
            <Segmented label="Mức độ" options={DIFFICULTY_OPTIONS} value={difficulty} onChange={setDifficulty} />
          </div>
        )}
        {(isAI || isTargeted) && (
          <BloomConfigSection
            preset={isTargeted && bloomPreset === "custom" ? "balanced" : bloomPreset}
            onPresetChange={setBloomPreset}
            customWeights={customWeights}
            onCustomChange={setCustomWeights}
            questionCount={effectiveCount}
            allowCustom={isAI}
          />
        )}
        {error && <p role="alert" className="rounded-xl bg-[var(--qz-danger-soft)] px-4 py-3 text-[13px] text-[var(--qz-danger)]">{error}</p>}
      </div>
    </Modal>
  );
}
