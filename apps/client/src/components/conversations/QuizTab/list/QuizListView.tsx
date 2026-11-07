"use client";

import { useMemo, useState } from "react";
import { Layers, PenLine, Plus, Search, Sparkles, TriangleAlert } from "lucide-react";
import type { Quiz, QuizAttempt, QuizSource } from "../types";
import { Button, Menu } from "../ui/primitives";
import { QuizCard } from "./QuizCard";
import { QuizEmptyState } from "./QuizEmptyState";

export function QuizListView({ quizzes, attempts, loading, error, onRetry, onCreate, onOpen, onStart, onEdit, onDelete }: {
  quizzes: Quiz[]; attempts: Record<string, QuizAttempt[]>; loading: boolean; error: string | null; onRetry: () => void;
  onCreate: (s: QuizSource) => void; onOpen: (q: Quiz) => void; onStart: (q: Quiz) => void; onEdit: (q: Quiz) => void; onDelete: (q: Quiz) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase();
    return t ? quizzes.filter((q) => q.title.toLowerCase().includes(t) || (q.description ?? "").toLowerCase().includes(t)) : quizzes;
  }, [quizzes, query]);

  if (loading)
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Đang tải bài kiểm tra">
        {[0, 1, 2].map((i) => <div key={i} className="h-[320px] animate-pulse rounded-[24px] bg-[var(--qz-fill)]" />)}
      </div>
    );

  if (error)
    return (
      <div role="alert" className="mx-auto mt-16 flex max-w-[420px] flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--qz-danger-soft)] text-[var(--qz-danger)]"><TriangleAlert className="h-6 w-6" /></span>
        <h2 className="mt-4 text-[20px] font-semibold tracking-[-0.015em]">Không tải được bài kiểm tra</h2>
        <p className="mt-1 text-[14px] text-[var(--on-surface-variant)]">{error}</p>
        <Button variant="secondary" className="mt-5" onClick={onRetry}>Thử lại</Button>
      </div>
    );

  if (quizzes.length === 0) return <QuizEmptyState onCreate={onCreate} />;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.025em] text-foreground sm:text-[32px] sm:leading-10">Bài kiểm tra</h1>
          <p className="mt-1 text-[14px] tabular-nums text-[var(--on-surface-variant)]">{quizzes.length} đề trong không gian học tập này</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--on-surface-variant)]" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm đề kiểm tra"
              aria-label="Tìm đề kiểm tra"
              className="apple-spring h-11 w-full rounded-xl border border-[var(--border-outline)] bg-card pl-10 pr-3 text-[15px] outline-none placeholder:text-[#777587] focus:border-primary focus:ring-[3px] focus:ring-primary/15"
            />
          </div>
          <Menu
            width={280}
            button={(p) => <Button variant="primary" icon={<Plus className="h-4 w-4" />} {...p}>Tạo đề mới</Button>}
            items={[
              { key: "ai", label: "Từ tài liệu bằng AI", description: "AI đọc tài liệu và soạn đề cho bạn", icon: <Sparkles className="h-4 w-4 text-[var(--qz-ai)]" />, onSelect: () => onCreate("ai") },
              { key: "deck", label: "Từ bộ Flashcard", description: "Tạo nhanh, không tốn lượt AI", icon: <Layers className="h-4 w-4 text-primary" />, onSelect: () => onCreate("flashcard") },
              { key: "manual", label: "Tự soạn đề", description: "Tự viết từng câu hỏi", icon: <PenLine className="h-4 w-4" />, onSelect: () => onCreate("manual") },
            ]}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-16 text-center text-[15px] text-[var(--on-surface-variant)]">Không có đề nào khớp “{query}”.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((q) => (
            <QuizCard
              key={q.id} quiz={q} attempts={attempts[q.id] ?? []}
              onOpen={() => onOpen(q)} onStart={() => onStart(q)} onEdit={() => onEdit(q)} onDelete={() => onDelete(q)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
