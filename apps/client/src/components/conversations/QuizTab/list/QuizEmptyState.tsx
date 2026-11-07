"use client";

import { Layers, ListChecks, Plus, Sparkles, Upload } from "lucide-react";
import type { QuizSource } from "../types";
import { Button } from "../ui/primitives";

/** Empty State tối giản, cùng ngôn ngữ với Tài liệu / Tóm tắt / Flashcard: 1 biểu tượng, tiêu đề, mô tả, hành động. */
export function QuizEmptyState({ onCreate, hasDocuments = true, hasDecks = false, onUploadDocument }: {
  onCreate: (s: QuizSource) => void;
  hasDocuments?: boolean;
  hasDecks?: boolean;
  onUploadDocument?: () => void;
}) {
  const needsDocuments = !hasDocuments && Boolean(onUploadDocument);

  return (
    <div className="qz-anim-pop flex min-h-[min(60dvh,560px)] flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-[var(--border-subtle)] bg-[var(--qz-fill)] text-foreground">
        <ListChecks className="h-7 w-7" aria-hidden />
      </div>

      <h2 className="mt-6 text-[24px] font-semibold leading-8 tracking-[-0.02em] text-foreground">Chưa có bài kiểm tra</h2>
      <p className="mt-2 max-w-[440px] text-[15px] leading-6 text-[var(--on-surface-variant)]">
        {needsDocuments
          ? "Tải tài liệu lên để AI soạn đề cho bạn, hoặc tự soạn đề thủ công."
          : "Tạo đề trắc nghiệm và tự luận từ tài liệu của bạn. AI chấm điểm theo ý nghĩa và chỉ ra phần cần ôn lại."}
      </p>

      <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        {needsDocuments ? (
          <Button variant="primary" size="lg" className="rounded-full!" icon={<Upload className="h-4 w-4" />} onClick={onUploadDocument}>
            Tải lên tài liệu
          </Button>
        ) : (
          <Button variant="primary" size="lg" className="rounded-full!" icon={<Sparkles className="h-4 w-4" />} onClick={() => onCreate("ai")}>
            Tạo đề bằng AI
          </Button>
        )}
        <Button variant="secondary" size="lg" className="rounded-full!" icon={<Plus className="h-4 w-4" />} onClick={() => onCreate("manual")}>
          Tự soạn đề
        </Button>
      </div>

      {hasDecks && (
        <Button variant="tertiary" size="sm" className="mt-3 rounded-full!" icon={<Layers className="h-4 w-4" />} onClick={() => onCreate("flashcard")}>
          Hoặc tạo nhanh từ bộ Flashcard
        </Button>
      )}

      <p className="mt-6 text-[13px] text-[var(--on-surface-variant)]">Trắc nghiệm · Đúng / Sai · Điền từ · Tự luận do AI chấm</p>
    </div>
  );
}
