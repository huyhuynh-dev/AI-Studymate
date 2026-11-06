import { Lightbulb, Plus, Sparkles, Upload } from "lucide-react";
import { Button, cx, FONT_HEADING, SQUIRCLE } from "../ui";
import { DeckStackIllustration } from "./DeckStackIllustration";

interface Props {
  hasDocuments: boolean;
  onCreateManual: () => void;
  onCreateAi: () => void;
  onUploadDocument?: () => void;
}

/** A1 — Chưa có bộ thẻ nào */
export function DecksEmptyState({ hasDocuments, onCreateManual, onCreateAi, onUploadDocument }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <DeckStackIllustration />
      <h2 className={cx(FONT_HEADING, "mt-8 text-[26px] font-semibold tracking-[-0.025em] text-[#0B1C30] sm:text-[32px]")}>
        Chưa có bộ thẻ nào
      </h2>
      <p className="mt-3 max-w-md text-[15px] leading-6 text-[#464555]/75">
        Ôn tập bằng phương pháp lặp lại ngắt quãng (SRS) giúp bạn ghi nhớ lâu hơn gấp 3 lần. Hãy tạo bộ thẻ đầu tiên của bạn.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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
      <div style={SQUIRCLE} className="mt-10 flex max-w-md items-start gap-3 rounded-2xl bg-[#EFF4FF]/70 px-4 py-3 text-left">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-[13px] leading-5 text-[#464555]/80">
          Tải tài liệu PDF lên tab <b className="font-semibold text-[#0B1C30]">Tài liệu</b> nếu muốn AI tự động trích xuất thẻ ghi nhớ cho bạn.
        </p>
      </div>
    </div>
  );
}
