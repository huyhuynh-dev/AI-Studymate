import type { CardStatus, CardType } from "../types";
import { SearchInput, Select } from "../ui";

export type TypeFilter = CardType | "all";
export type StatusFilter = CardStatus | "all";

interface Props {
  query: string;
  onQuery: (v: string) => void;
  type: TypeFilter;
  onType: (v: TypeFilter) => void;
  status: StatusFilter;
  onStatus: (v: StatusFilter) => void;
}

export function CardListToolbar({ query, onQuery, type, onType, status, onStatus }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchInput className="w-full sm:w-64" value={query} onChange={onQuery} placeholder="Tìm nội dung thẻ…" />
      <Select<TypeFilter>
        label="Lọc theo loại thẻ"
        value={type}
        onChange={onType}
        options={[
          { value: "all", label: "Loại: Tất cả" },
          { value: "basic", label: "Cơ bản" },
          { value: "cloze", label: "Điền khuyết" },
          { value: "typein", label: "Gõ đáp án" },
        ]}
      />
      <Select<StatusFilter>
        label="Lọc theo trạng thái học"
        value={status}
        onChange={onStatus}
        options={[
          { value: "all", label: "Trạng thái: Tất cả" },
          { value: "new", label: "Mới" },
          { value: "learning", label: "Đang học" },
          { value: "review", label: "Ôn tập" },
        ]}
      />
    </div>
  );
}
