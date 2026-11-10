"use client";

import { Check, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import type { AiDocument } from "../types";
import { Collapse, cx, Input, SegmentedControl, SPRING, SQUIRCLE } from "../ui";

type Mode = "all" | "selected";
export type DocumentSelection = string[] | "all";

interface Props {
  documents: AiDocument[];
  value?: DocumentSelection;
  onChange: (value: DocumentSelection) => void;
}

const SEARCH_THRESHOLD = 6;

export function DocumentPicker({ documents, value = "all", onChange }: Props) {
  const [mode, setMode] = useState<Mode>(value === "all" ? "all" : "selected");
  const [picked, setPicked] = useState<string[]>(Array.isArray(value) ? value : []);
  const [query, setQuery] = useState("");

  const documentIds = useMemo(() => new Set(documents.map((document) => document.id)), [documents]);
  const validPicked = useMemo(() => picked.filter((id) => documentIds.has(id)), [documentIds, picked]);

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return normalizedQuery
      ? documents.filter((document) => document.name.toLowerCase().includes(normalizedQuery))
      : documents;
  }, [documents, query]);

  const emit = (nextMode: Mode, nextPicked: string[]) => {
    onChange(nextMode === "all" ? "all" : nextPicked);
  };

  if (documents.length === 0) {
    return (
      <p style={SQUIRCLE} className="rounded-2xl bg-[#EFF4FF]/70 px-4 py-3 text-[13px] leading-5 text-[#464555]">
        Phiên học này chưa có tài liệu. Hãy tải tài liệu lên trước khi tạo thẻ bằng AI.
      </p>
    );
  }

  if (documents.length === 1) {
    return (
      <div style={SQUIRCLE} className="flex min-h-11 items-center gap-3 rounded-2xl bg-[#EFF4FF]/70 px-4 py-2">
        <FileText className="h-4 w-4 shrink-0 text-[#777587]" />
        <DocumentText document={documents[0]} />
      </div>
    );
  }

  const toggle = (id: string) => {
    const nextPicked = validPicked.includes(id) ? validPicked.filter((pickedId) => pickedId !== id) : [...validPicked, id];
    setPicked(nextPicked);
    emit(mode, nextPicked);
  };

  const allVisibleSelected = visible.length > 0 && visible.every((document) => validPicked.includes(document.id));
  const toggleVisible = () => {
    const visibleIds = new Set(visible.map((document) => document.id));
    const nextPicked = allVisibleSelected
      ? validPicked.filter((id) => !visibleIds.has(id))
      : [...new Set([...validPicked, ...visibleIds])];
    setPicked(nextPicked);
    emit(mode, nextPicked);
  };

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl<Mode>
        value={mode}
        onChange={(nextMode) => {
          setMode(nextMode);
          emit(nextMode, validPicked);
        }}
        options={[
          { value: "all", label: `Tất cả (${documents.length})` },
          { value: "selected", label: "Chọn tài liệu" },
        ]}
      />

      <Collapse open={mode === "all"}>
        <p className="text-[13px] leading-5 text-[#777587]">
          AI sẽ dùng toàn bộ <span className="font-semibold tabular-nums text-[#464555]">{documents.length}</span> tài liệu của phiên học.
        </p>
      </Collapse>

      <Collapse open={mode === "selected"}>
        <div className="flex flex-col gap-2">
          {documents.length > SEARCH_THRESHOLD && (
            <Input aria-label="Tìm tài liệu" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tài liệu…" />
          )}

          <div style={SQUIRCLE} className="rounded-2xl bg-[#EFF4FF]/70 p-2">
            <div className="flex items-center justify-between px-3 pb-1 pt-0.5">
              <span className="text-[12px] font-semibold tabular-nums text-[#777587]">
                Đã chọn {validPicked.length}/{documents.length}
              </span>
              <button
                type="button"
                onClick={toggleVisible}
                disabled={visible.length === 0}
                className={cx(
                  "h-8 cursor-pointer rounded-lg px-2 text-[13px] font-semibold text-indigo-600 transition-all duration-300 hover:bg-white/70 hover:text-[#3525CD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
                  SPRING
                )}
              >
                {allVisibleSelected ? "Bỏ chọn" : "Chọn tất cả"}
              </button>
            </div>

            <div role="group" aria-label="Tài liệu nguồn" className="flex max-h-[232px] flex-col gap-1 overflow-y-auto">
              {visible.length === 0 ? (
                <p className="px-3 py-4 text-center text-[13px] text-[#777587]">Không tìm thấy tài liệu phù hợp.</p>
              ) : (
                visible.map((document) => (
                  <DocumentRow
                    key={document.id}
                    document={document}
                    checked={validPicked.includes(document.id)}
                    onToggle={() => toggle(document.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </Collapse>
    </div>
  );
}

function DocumentText({ document }: { document: AiDocument }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[14px] font-medium text-[#0B1C30]">{document.name}</span>
      {document.meta && <span className="block truncate text-[12px] tabular-nums text-[#777587]">{document.meta}</span>}
    </span>
  );
}

function DocumentRow({
  document,
  checked,
  onToggle,
}: {
  document: AiDocument;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      style={SQUIRCLE}
      className={cx(
        "flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2 transition-all duration-300 active:scale-[0.98]",
        SPRING,
        checked ? "bg-white shadow-[inset_0_1px_0_rgba(255,255,255,1),0_2px_8px_-2px_rgba(11,28,48,0.12)]" : "hover:bg-white/60"
      )}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="peer sr-only" />
      <span
        aria-hidden
        className={cx(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] transition-all duration-300 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-600 peer-focus-visible:ring-offset-2",
          SPRING,
          checked ? "border-indigo-600 bg-indigo-600 text-white" : "border-[#777587]/50 bg-white"
        )}
      >
        <Check className={cx("h-3 w-3 transition-transform duration-300", SPRING, checked ? "scale-100" : "scale-0")} strokeWidth={3} />
      </span>
      <FileText className="h-4 w-4 shrink-0 text-[#777587]" />
      <DocumentText document={document} />
    </label>
  );
}
