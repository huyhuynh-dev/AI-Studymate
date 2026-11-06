import { Lightbulb, Plus, Sparkles, Upload } from "lucide-react";
import { Button, cx, FONT_HEADING, SQUIRCLE } from "../ui";
import { DeckStackIllustration } from "./DeckStackIllustration";

interface Props {
  hasDocuments: boolean;
  onCreateManual: () => void;
  onCreateAi: () => void;
  onUploadDocument?: () => void;
}

/** A1 — Chưa có bộ thẻ nào (Hero Empty State chuẩn Apple HIG) */
export function DecksEmptyState({ hasDocuments, onCreateManual, onCreateAi, onUploadDocument }: Props) {
  return (
    <div
      style={SQUIRCLE}
      className="flex flex-1 flex-col items-center justify-center rounded-[28px] border border-black/[0.06] dark:border-white/[0.08] bg-linear-to-b from-indigo-500/[0.03] to-purple-500/[0.02] dark:from-white/[0.03] dark:to-white/[0.01] px-6 py-12 sm:px-12 sm:py-16 text-center backdrop-blur-sm"
    >
      <DeckStackIllustration />
      <h2 className={cx(FONT_HEADING, "mt-7 text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white")}>
        Chưa có bộ thẻ ghi nhớ nào
      </h2>
      <p className="mt-2.5 max-w-md text-sm sm:text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-400">
        Ôn tập bằng phương pháp lặp lại ngắt quãng (SRS) giúp bạn ghi nhớ lâu hơn gấp 3 lần. Hãy tạo bộ thẻ đầu tiên của bạn.
      </p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        {hasDocuments ? (
          <Button variant="primary" size="lg" icon={<Sparkles className="h-4 w-4" />} onClick={onCreateAi}>
            Tạo bộ thẻ bằng AI
          </Button>
        ) : (
          <Button variant="primary" size="lg" icon={<Upload className="h-4 w-4" />} onClick={onUploadDocument}>
            Tải tài liệu để kích hoạt AI
          </Button>
        )}
        <Button size="lg" icon={<Plus className="h-4 w-4" />} onClick={onCreateManual}>
          Tạo bộ thẻ thủ công
        </Button>
      </div>
      <div
        style={SQUIRCLE}
        className="mt-8 flex max-w-md items-start gap-3 rounded-2xl border border-black/[0.05] dark:border-white/[0.07] bg-white/80 dark:bg-white/[0.04] px-4 py-3 text-left shadow-2xs"
      >
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-xs sm:text-[13px] leading-5 text-neutral-600 dark:text-neutral-400">
          Tải tài liệu PDF lên tab <b className="font-semibold text-neutral-900 dark:text-white">Tài liệu</b> nếu muốn AI tự động trích xuất thẻ ghi nhớ cho bạn.
        </p>
      </div>
    </div>
  );
}
