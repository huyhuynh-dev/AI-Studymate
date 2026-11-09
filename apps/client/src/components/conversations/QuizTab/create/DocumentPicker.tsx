"use client";

import { useMemo, useState } from "react";
import { Check, FileText, Minus, Search } from "lucide-react";
import type { DocumentOption } from "../types";
import { cx } from "../utils";

type MarkState = "on" | "off" | "mixed";

function Marker({ state }: { state: MarkState }) {
  return (
    <span
      aria-hidden
      className={cx(
        "apple-spring flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] text-white",
        state === "off" ? "border-[var(--border-outline)]" : "border-primary bg-primary",
      )}
    >
      {state === "on" && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      {state === "mixed" && <Minus className="h-3.5 w-3.5" strokeWidth={3} />}
    </span>
  );
}

const ROW =
  "apple-spring flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left outline-none hover:bg-[var(--qz-fill)] focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99]";

/** Bộ chọn tài liệu nguồn: nhóm danh sách kiểu iOS (checkbox tròn), có "Tất cả" 3 trạng thái. */
export function DocumentPicker({ documents, value, onChange, error }: {
  documents: DocumentOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string | null;
}) {
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(value), [value]);
  const visible = useMemo(() => {
    const t = query.trim().toLowerCase();
    return t ? documents.filter((d) => d.name.toLowerCase().includes(t)) : documents;
  }, [documents, query]);

  const selectedVisible = visible.filter((d) => selected.has(d.id)).length;
  const allVisible = visible.length > 0 && selectedVisible === visible.length;
  const headState: MarkState = allVisible ? "on" : selectedVisible > 0 ? "mixed" : "off";

  const toggleAll = () => {
    if (allVisible) {
      const remove = new Set(visible.map((d) => d.id));
      onChange(value.filter((id) => !remove.has(id)));
    } else {
      const next = new Set<string>(value);
      visible.forEach((d) => next.add(d.id));
      onChange(Array.from(next));
    }
  };
  const toggle = (id: string) => onChange(selected.has(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-[14px] font-semibold">Tài liệu nguồn</p>
        <p className="text-[13px] tabular-nums text-[var(--on-surface-variant)]" aria-live="polite">
          {value.length}/{documents.length} đã chọn
        </p>
      </div>

      {documents.length > 6 && (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--on-surface-variant)]" aria-hidden />
          <input
            type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tài liệu" aria-label="Tìm tài liệu"
            className="apple-spring h-11 w-full rounded-xl border border-[var(--border-outline)] bg-card pl-10 pr-3 text-[15px] outline-none placeholder:text-[#777587] focus:border-primary focus:ring-[3px] focus:ring-primary/15"
          />
        </div>
      )}

      {/* Đồng tâm: khung 16px, đệm 6px → hàng 10px */}
      <div className={cx("rounded-2xl border bg-card p-1.5", error ? "border-[var(--qz-danger)]" : "border-[var(--border-outline)]")}>
        <button
          type="button" role="checkbox" aria-checked={headState === "mixed" ? "mixed" : headState === "on"}
          onClick={toggleAll} disabled={visible.length === 0}
          className={cx(ROW, "font-semibold disabled:opacity-40")}
        >
          <Marker state={headState} />
          <span className="text-[14.5px]">{query ? "Chọn tất cả kết quả" : "Tất cả tài liệu"}</span>
        </button>
        <div className="mx-3 my-1 h-px bg-[var(--border-subtle)]" />
        <ul role="group" aria-label="Danh sách tài liệu" className="max-h-[216px] overflow-y-auto overscroll-contain">
          {visible.map((d) => (
            <li key={d.id}>
              <button type="button" role="checkbox" aria-checked={selected.has(d.id)} onClick={() => toggle(d.id)} className={ROW}>
                <Marker state={selected.has(d.id) ? "on" : "off"} />
                <FileText className="h-[18px] w-[18px] shrink-0 text-[var(--on-surface-variant)]" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium">{d.name}</span>
                  {d.meta && <span className="block truncate text-[12.5px] text-[var(--on-surface-variant)]">{d.meta}</span>}
                </span>
              </button>
            </li>
          ))}
          {visible.length === 0 && <li className="px-3 py-5 text-center text-[13px] text-[var(--on-surface-variant)]">Không tìm thấy tài liệu nào.</li>}
        </ul>
      </div>
      {error && <p role="alert" className="mt-1.5 text-[13px] text-[var(--qz-danger)]">{error}</p>}
    </div>
  );
}
