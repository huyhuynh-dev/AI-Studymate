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

/**
 * Nút chọn mô hình trong ô nhập + popover gồm:
 *  - Danh sách mô hình (StudyMate Flash, Pro, Deep)
 *  - Độ ưu tiên: Nhanh, Cân bằng, Suy luận sâu
 */
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
        className="flex h-8 min-w-0 max-w-37.5 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-indigo-500"
      >
        <span className="truncate">{model.name}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute inset-x-0 bottom-full z-50 mb-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-100 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <p className="px-4 pb-1 pt-3 text-xs font-medium text-gray-500">
            Mô hình
          </p>

          <div className="space-y-0.5 px-1.5 pb-1.5">
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
                  className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${
                    selected ? "bg-indigo-50" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-gray-900">
                      {m.name}
                    </span>
                    <span className="block truncate text-[11px] text-gray-500">
                      {m.desc}
                    </span>
                  </span>
                  {selected && (
                    <Check className="h-4 w-4 shrink-0 text-indigo-600" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="border-t border-gray-100 px-3 py-2.5">
            <p className="mb-2 text-xs font-medium text-gray-500">
              Độ ưu tiên:
            </p>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100/80 p-1">
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
                        ? "bg-white border border-gray-200/80 text-indigo-600 shadow-xs font-semibold"
                        : "border border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-200/50 font-medium"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
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
