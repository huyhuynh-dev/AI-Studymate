"use client";

import React from 'react';
import { ListTree, X } from 'lucide-react';

export interface OutlineHeadingItem {
  id: string;
  level: number;
  text: string;
  pos: number;
}

export interface DocumentOutlineSidebarProps {
  headings: OutlineHeadingItem[];
  onSelectHeading: (item: OutlineHeadingItem) => void;
  onClose: () => void;
}

export function DocumentOutlineSidebar({
  headings,
  onSelectHeading,
  onClose,
}: DocumentOutlineSidebarProps) {
  const getIndentClass = (level: number) => {
    if (level <= 1) return 'pl-2.5 font-semibold text-neutral-900 dark:text-neutral-100';
    if (level === 2) return 'pl-5 font-medium text-neutral-700 dark:text-neutral-200';
    if (level === 3) return 'pl-7 text-neutral-600 dark:text-neutral-300';
    return 'pl-9 text-neutral-500 dark:text-neutral-400';
  };

  return (
    <aside
      aria-label="Mục lục tài liệu"
      className="flex h-full w-64 sm:w-72 shrink-0 flex-col border-r border-black/[0.06] dark:border-white/[0.08] bg-white/95 dark:bg-[#12151C]/95 backdrop-blur-xl select-none"
    >
      <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.08] px-3.5 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-[#4F46E5] dark:text-[#818CF8]">
            <ListTree className="h-4 w-4" />
          </span>
          <h3 className="truncate text-[13px] font-semibold font-heading text-neutral-900 dark:text-white tracking-tight">
            Mục lục tài liệu
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng mục lục"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5">
        {headings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/[0.08] dark:border-white/[0.08] bg-neutral-50/70 dark:bg-white/[0.02] p-4 text-center">
            <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              Chưa có tiêu đề nào. Hãy chọn kiểu{' '}
              <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                Tiêu đề 1–3
              </span>{' '}
              trên thanh công cụ để tạo mục lục tự động.
            </p>
          </div>
        ) : (
          <nav className="flex flex-col gap-0.5" aria-label="Danh sách tiêu đề">
            {headings.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectHeading(item)}
                title={item.text}
                className={`group flex w-full items-center gap-2 rounded-lg py-1.5 pr-2.5 text-left text-[12.5px] transition-colors hover:bg-indigo-500/[0.08] hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer ${getIndentClass(item.level)}`}
              >
                <span className="shrink-0 rounded bg-neutral-100 dark:bg-white/[0.06] px-1 py-0.5 text-[10px] font-mono text-neutral-500 dark:text-neutral-400 group-hover:bg-indigo-500/15 group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
                  H{item.level}
                </span>
                <span className="truncate">{item.text}</span>
              </button>
            ))}
          </nav>
        )}
      </div>
    </aside>
  );
}
