import { Layers, Plus, Sparkles, Upload } from "lucide-react";
import { Button, cx, FONT_HEADING } from "../ui";

interface Props {
  hasDocuments: boolean;
  onCreateManual: () => void;
  onCreateAi: () => void;
  onUploadDocument?: () => void;
}

/** A1 — Chưa có bộ thẻ nào (Empty State tối giản chuẩn Apple HIG) */
export function DecksEmptyState({ hasDocuments, onCreateManual, onCreateAi, onUploadDocument }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center select-none">
      {/* Biểu tượng Apple Tonal Squircle */}
      <div className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/70 dark:bg-white/[0.04] text-neutral-700 dark:text-neutral-200 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.04)]">
        <Layers className="h-7 w-7 stroke-[1.75]" />
      </div>

      <h2 className={cx(FONT_HEADING, "mt-5 text-[19px] sm:text-[21px] font-semibold tracking-[-0.02em] text-neutral-900 dark:text-neutral-100")}>
        Chưa có bộ thẻ ghi nhớ
      </h2>

      <p className="mt-2 max-w-[360px] text-[14px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        Tạo bộ thẻ từ tài liệu bằng AI hoặc tự biên soạn thủ công để ôn tập ngắt quãng hiệu quả.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        {hasDocuments ? (
          <Button variant="primary" icon={<Sparkles className="h-4 w-4" />} onClick={onCreateAi}>
            Tạo bằng AI
          </Button>
        ) : (
          <Button variant="primary" icon={<Upload className="h-4 w-4" />} onClick={onUploadDocument}>
            Tải lên tài liệu
          </Button>
        )}
        <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={onCreateManual}>
          Tạo thủ công
        </Button>
      </div>
    </div>
  );
}
