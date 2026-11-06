import { ChevronLeft } from "lucide-react";
import { cx, FONT_HEADING } from "../ui";

/** Thanh điều hướng phụ: ← Danh sách bộ thẻ / Tên bộ thẻ */
export function SubNav({ deckName, onBack }: { deckName: string; onBack: () => void }) {
  return (
    <nav aria-label="Điều hướng phụ" className="flex items-center gap-2 text-sm">
      <button
        type="button"
        onClick={onBack}
        className={cx(FONT_HEADING, "-ml-2 inline-flex h-9 cursor-pointer items-center gap-1 rounded-xl px-2.5 font-semibold text-indigo-600 transition-all duration-300 hover:bg-indigo-50 active:scale-95")}
      >
        <ChevronLeft className="h-4 w-4" />
        Danh sách bộ thẻ
      </button>
      <span className="text-[#C7C4D8]">/</span>
      <span className="line-clamp-1 font-medium text-[#464555]">{deckName}</span>
    </nav>
  );
}
