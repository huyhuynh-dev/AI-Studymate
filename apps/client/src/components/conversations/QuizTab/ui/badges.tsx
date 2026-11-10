import { Layers, PenLine, Sparkles } from "lucide-react";
import type { EvaluationStatus, Quiz, QuestionType } from "../types";
import { EVAL_META, QUESTION_TYPE_META } from "../constants";
import { Badge } from "./primitives";

export function SourceBadge({ quiz }: { quiz: Pick<Quiz, "source" | "sourceDeckName"> }) {
  if (quiz.source === "ai") return <Badge tone="ai" icon={<Sparkles className="h-3 w-3" aria-hidden />}>Tạo bởi AI</Badge>;
  if (quiz.source === "flashcard")
    return (
      <Badge tone="primary" icon={<Layers className="h-3 w-3" aria-hidden />} className="max-w-full">
        <span className="truncate">{quiz.sourceDeckName ? `Từ bộ thẻ: ${quiz.sourceDeckName}` : "Từ bộ Flashcard"}</span>
      </Badge>
    );
  return <Badge tone="neutral" icon={<PenLine className="h-3 w-3" aria-hidden />}>Tự soạn</Badge>;
}

export const TypeBadge = ({ type }: { type: QuestionType }) => <Badge tone="neutral">{QUESTION_TYPE_META[type].short}</Badge>;

export function EvalBadge({ status, points }: { status: EvaluationStatus; points?: string }) {
  const m = EVAL_META[status];
  return <Badge tone={m.tone}>{points ? `${m.label} · ${points}` : m.label}</Badge>;
}
