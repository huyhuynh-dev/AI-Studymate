import React from "react";
import { Sparkles } from "lucide-react";
import { STARTER_PROMPTS } from "../constants";
import { getGreeting } from "../utils";

interface EmptyStateProps {
  onPromptSelect?: (prompt: string) => void;
}

export function EmptyState({ onPromptSelect }: EmptyStateProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden select-none">
      <div className="flex flex-col items-center gap-3.5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2FF] dark:bg-[#4F46E5]/20 text-[#4F46E5] dark:text-[#818CF8] border border-[#C7D2FE] dark:border-[#4F46E5]/30 shadow-xs transition-transform hover:scale-105 duration-200">
          <Sparkles className="h-6 w-6 stroke-[1.8]" />
        </div>
        <div className="space-y-1">
          <h3
            className="text-lg font-bold text-[#0B1C30] dark:text-[#EFF0F6] tracking-tight"
            suppressHydrationWarning
          >
            {getGreeting()}
          </h3>
          <p className="max-w-68 text-xs sm:text-sm leading-relaxed text-[#777587] dark:text-[#9DA3AF]">
            Đặt câu hỏi về tài liệu hoặc chọn một chủ đề gợi ý bên dưới để bắt đầu.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-2 max-w-sm">
        {STARTER_PROMPTS.map(({ icon: Icon, label, prompt }) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (prompt) {
                onPromptSelect?.(prompt);
              }
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-[#E5EEFF] dark:border-white/[0.08] bg-white dark:bg-[#161922] px-3.5 py-2.5 text-left text-xs font-semibold text-[#464555] dark:text-[#EFF0F6] shadow-2xs transition-all hover:border-[#C7C4D8] dark:hover:border-white/[0.2] hover:text-[#4F46E5] dark:hover:text-[#818CF8] hover:shadow-xs active:scale-[0.98]"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FF] dark:bg-white/[0.06] text-[#4F46E5] dark:text-[#818CF8]">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
