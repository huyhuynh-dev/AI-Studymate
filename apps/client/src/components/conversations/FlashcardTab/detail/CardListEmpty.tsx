import { Layers, Plus, Sparkles } from "lucide-react";
import { Button, cx, FONT_HEADING, SQUIRCLE } from "../ui";

/** A4 / Tầng 3 — Bộ thẻ chưa có flashcard nào */
export function CardListEmpty({ onCreate, onAi }: { onCreate: () => void; onAi: () => void }) {
  return (
    <div style={SQUIRCLE} className="flex flex-col items-center rounded-3xl border-2 border-dashed border-[#C7C4D8]/70 px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EFF4FF] text-indigo-500">
        <Layers className="h-6 w-6" />
      </span>
      <h3 className={cx(FONT_HEADING, "mt-4 text-lg font-semibold text-[#0B1C30]")}>Bộ thẻ này chưa có nội dung</h3>
      <p className="mt-1 max-w-sm text-[13px] text-[#464555]/70">Thêm thẻ thủ công hoặc để AI trích xuất tự động từ tài liệu của bạn.</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={onCreate}>
          Tạo thẻ đầu tiên
        </Button>
        <Button icon={<Sparkles className="h-4 w-4 text-indigo-600" />} onClick={onAi}>
          Trích xuất tự động từ tài liệu
        </Button>
      </div>
    </div>
  );
}
