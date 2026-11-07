"use client";

import { useEffect, useRef } from "react";
import { cx } from "../utils";

export interface PaletteItem { answered: boolean; flagged: boolean }

function Cell({ n, item, current, onClick, size }: { n: number; item: PaletteItem; current: boolean; onClick: () => void; size: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={current ? "step" : undefined}
      aria-label={`Câu ${n}${item.answered ? ", đã trả lời" : ", chưa trả lời"}${item.flagged ? ", đánh dấu xem lại" : ""}`}
      className={cx(
        "apple-spring relative shrink-0 rounded-xl text-[14px] font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95",
        size,
        item.answered ? "bg-[var(--qz-primary-soft)] text-primary" : "border border-[var(--border-outline)] bg-card text-[var(--on-surface-variant)]",
        current && "!border-2 !border-primary",
      )}
    >
      {n}
      {item.flagged && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--qz-warning)]" aria-hidden />}
    </button>
  );
}

/** grid: cột phụ bên phải (desktop). strip: dải cuộn ngang (mobile / tablet nhỏ). */
export function QuestionPalette({ items, current, onSelect, variant }: {
  items: PaletteItem[]; current: number; onSelect: (i: number) => void; variant: "grid" | "strip";
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (variant !== "strip") return;
    const el = stripRef.current?.children[current] as HTMLElement | undefined;
    el?.scrollIntoView?.({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [current, variant]);

  if (variant === "strip")
    return (
      <div ref={stripRef} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1 sm:-mx-6 sm:px-6" role="navigation" aria-label="Danh sách câu hỏi">
        {items.map((it, i) => <Cell key={i} n={i + 1} item={it} current={i === current} onClick={() => onSelect(i)} size="h-11 w-11" />)}
      </div>
    );

  return (
    <nav aria-label="Danh sách câu hỏi" className="rounded-[24px] border border-[var(--border-subtle)] bg-card p-5 shadow-[var(--qz-shadow-card)]">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Danh sách câu hỏi</h2>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {items.map((it, i) => <Cell key={i} n={i + 1} item={it} current={i === current} onClick={() => onSelect(i)} size="aspect-square" />)}
      </div>
      <dl className="mt-5 grid gap-2 text-[12.5px] text-[var(--on-surface-variant)]">
        <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-md bg-[var(--qz-primary-soft)] ring-1 ring-primary/30" />Đã trả lời</div>
        <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-md border border-[var(--border-outline)]" />Chưa trả lời</div>
        <div className="flex items-center gap-2"><span className="flex h-3.5 w-3.5 items-center justify-center"><span className="h-2 w-2 rounded-full bg-[var(--qz-warning)]" /></span>Đánh dấu xem lại</div>
      </dl>
    </nav>
  );
}
