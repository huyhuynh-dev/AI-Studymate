"use client";

import React, { useCallback, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { AVAILABLE_MODELS, PRIORITY_OPTIONS } from "../constants";
import { useClickOutside } from "../hooks/useClickOutside";
import type { ModelConfig } from "../types";

interface ModelSelectorProps {
  config: ModelConfig;
  onChange: (patch: Partial<ModelConfig>) => void;
}

export function ModelSelector({ config, onChange }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);
  useClickOutside(containerRef, close, isOpen);

  const model =
    AVAILABLE_MODELS.find((m) => m.id === config.modelId) ?? AVAILABLE_MODELS[0];

  const activePriority =
    config.thinking || config.effort === "high" || config.effort === "extra" || config.effort === "max"
      ? "deep"
      : config.effort === "low"
        ? "fast"
        : "balanced";

  const priorityLabel =
    PRIORITY_OPTIONS.find((p) => p.key === activePriority)?.label ?? "Cân bằng";

  return (
    <div ref={containerRef} className="contents">
      <button
        type="button"
        onClick={() => (isOpen ? close() : setIsOpen(true))}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={`${model.name} · Độ ưu tiên: ${priorityLabel}`}
        className="flex h-8 min-w-0 max-w-38 cursor-pointer items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-[#464555] dark:text-[#EFF0F6] transition-all hover:bg-[#F8F9FF] dark:hover:bg-white/[0.06] hover:text-[#0B1C30] dark:hover:text-white focus-visible:outline-2 focus-visible:outline-[#4F46E5]"
      >
        <span className="truncate">{model.name}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[#777587] transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute inset-x-0 bottom-full z-50 mb-2 max-h-[70vh] overflow-y-auto rounded-[22px] border border-[#E5EEFF] dark:border-white/[0.12] bg-white/95 dark:bg-[#161922]/95 backdrop-blur-xl shadow-2xl animate-in fade-in-50 zoom-in-95 duration-100 select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-[#777587] dark:text-neutral-400">
            Mô hình AI
          </p>

          <div className="space-y-0.5 px-2 pb-2">
            {AVAILABLE_MODELS.map((m) => {
              const selected = m.id === config.modelId;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => {
                    onChange({ modelId: m.id });
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition-colors ${
                    selected
                      ? "bg-[#EEF2FF] dark:bg-[#4F46E5]/20 text-[#4F46E5] dark:text-[#818CF8]"
                      : "hover:bg-[#F8F9FF] dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-[#0B1C30] dark:text-[#EFF0F6]">
                      {m.name}
                    </span>
                    <span className="block truncate text-[11px] text-[#777587] dark:text-[#9DA3AF]">
                      {m.desc}
                    </span>
                  </span>
                  {selected && (
                    <Check className="h-4 w-4 shrink-0 text-[#4F46E5] dark:text-[#818CF8]" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="border-t border-[#E5EEFF] dark:border-white/[0.08] px-3.5 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#777587] dark:text-neutral-400">
              Độ ưu tiên suy luận:
            </p>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#F8F9FF] dark:bg-white/[0.04] border border-[#E5EEFF] dark:border-white/[0.06] p-1">
              {PRIORITY_OPTIONS.map((opt) => {
                const isSelected = activePriority === opt.key;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      onChange({ effort: opt.effort, thinking: opt.thinking });
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-1 text-xs transition-all cursor-pointer ${
                      isSelected
                        ? "bg-white dark:bg-[#12151C] border border-[#E5EEFF] dark:border-white/[0.1] text-[#4F46E5] dark:text-[#818CF8] shadow-xs font-bold"
                        : "border border-transparent text-[#777587] hover:text-[#0B1C30] dark:hover:text-white font-medium"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
