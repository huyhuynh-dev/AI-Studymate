import React from "react";
import { Sparkles } from "lucide-react";
import { STARTER_PROMPTS } from "../constants";
import { getGreeting } from "../utils";

interface EmptyStateProps {
  onPromptSelect: (prompt: string) => void;
}

export function EmptyState({ onPromptSelect }: EmptyStateProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          {/* Lời chào phụ thuộc giờ của máy → tránh cảnh báo hydration giữa server & client */}
          <h3
            className="text-base font-semibold text-gray-900"
            suppressHydrationWarning
          >
            {getGreeting()}
          </h3>
          <p className="max-w-65 text-sm leading-relaxed text-gray-500">
            Đặt câu hỏi về tài liệu hoặc bắt đầu từ một gợi ý bên dưới.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-2">
        {STARTER_PROMPTS.map(({ icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => onPromptSelect(label)}
            className="flex w-full max-w-75 cursor-pointer items-center gap-2.5 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-left text-xs font-medium text-gray-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-900 active:scale-[0.99]"
          >
            <Icon className="h-4 w-4 shrink-0 text-indigo-500" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
