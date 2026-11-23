import { Layers, PenLine } from "lucide-react";
import { StudyMateAiIcon } from "@/components/ui/StudyMateAiIcon";
import type { BloomLevel, EvaluationStatus, Quiz, QuestionType } from "../types";
import { BLOOM_META, EVAL_META, QUESTION_TYPE_META } from "../constants";
import { Badge } from "./primitives";

export function SourceBadge({ quiz }: { quiz: Pick<Quiz, "source" | "sourceDeckName"> }) {
  if (quiz.source === "ai") return <Badge tone="ai" icon={<StudyMateAiIcon variant="simple" className="h-3 w-3" />}>Tạo bởi AI</Badge>;
  if (quiz.source === "flashcard")
    return (
      <Badge tone="primary" icon={<Layers className="h-3 w-3" aria-hidden />} className="max-w-full">
        <span className="truncate">{quiz.sourceDeckName ? `Từ bộ thẻ: ${quiz.sourceDeckName}` : "Từ bộ Flashcard"}</span>
      </Badge>
    );
  return <Badge tone="neutral" icon={<PenLine className="h-3 w-3" aria-hidden />}>Tự soạn</Badge>;
}

export const TypeBadge = ({ type }: { type: QuestionType }) => <Badge tone="neutral">{QUESTION_TYPE_META[type].short}</Badge>;

export const BloomBadge = ({ level }: { level?: BloomLevel | null }) => {
  if (!level) return null;
  const meta = BLOOM_META[level];
  if (!meta) return null;
  return (
    <span title={meta.description} className="inline-flex">
      <Badge tone={meta.tone}>{meta.short}</Badge>
    </span>
  );
};

export function EvalBadge({ status, points }: { status: EvaluationStatus; points?: string }) {
  const m = EVAL_META[status];
  return <Badge tone={m.tone}>{points ? `${m.label} · ${points}` : m.label}</Badge>;
}
