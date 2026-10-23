"use client";

import React, { useCallback, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { AVAILABLE_MODELS, EFFORT_LEVELS } from "../constants";
import { useClickOutside } from "../hooks/useClickOutside";
import type { ModelConfig } from "../types";
import { ToggleSwitch } from "./ToggleSwitch";

type PanelView = "main" | "effort";

interface ModelSelectorProps {
  config: ModelConfig;
  onChange: (patch: Partial<ModelConfig>) => void;
}

/**
 * Nút chọn mô hình trong ô nhập + popover gồm:
 *  - Danh sách mô hình
 *  - Mức độ suy luận (mở màn hình con ngay trong popover, phù hợp sidebar hẹp)
 *  - Công tắc Suy luận sâu
 * Popover căn theo ô nhập (ChatComposer, đang là `relative`).
 */
export function ModelSelector({ config, onChange }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<PanelView>("main");
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    setView("main");
  }, []);
  useClickOutside(containerRef, close, isOpen);

  const model =
    AVAILABLE_MODELS.find((m) => m.id === config.modelId) ?? AVAILABLE_MODELS[0];
  const effort =
    EFFORT_LEVELS.find((e) => e.key === config.effort) ?? EFFORT_LEVELS[1];

  return (
    <div ref={containerRef} className="contents">
      <button
        type="button"
        onClick={() => (isOpen ? close() : setIsOpen(true))}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={`${model.name} · Mức độ suy luận: ${effort.label}`}
        className="flex h-8 min-w-0 max-w-37.5 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-indigo-500"
      >
        <span className="truncate">{model.name}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""
            }`}
        />
      </button>

      {isOpen && (
        <div className="absolute inset-x-0 bottom-full z-50 mb-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-100">
          {view === "main" ? (
            <>
              <p className="px-4 pb-1 pt-3 text-xs font-medium text-gray-500">
                Chọn mô hình
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
                        close();
                      }}
                      className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${selected ? "bg-indigo-50" : "hover:bg-gray-50"
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

              <div className="border-t border-gray-100 p-1.5">
                <button
                  type="button"
                  onClick={() => setView("effort")}
                  className="flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                >
                  <span>Mức độ suy luận</span>
                  <span className="flex items-center gap-1 text-xs font-medium text-gray-500">
                    {effort.label}
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                  </span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900">Suy luận sâu</p>
                  <p className="text-[11px] leading-snug text-gray-500">
                    Có thể suy nghĩ lâu hơn với tác vụ phức tạp
                  </p>
                </div>
                <ToggleSwitch
                  checked={config.thinking}
                  onChange={() => onChange({ thinking: !config.thinking })}
                  label="Bật suy luận sâu"
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1 border-b border-gray-100 px-2 py-2">
                <button
                  type="button"
                  aria-label="Quay lại"
                  onClick={() => setView("main")}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-[13px] font-semibold text-gray-900">
                  Mức độ suy luận
                </span>
              </div>

              <p className="px-4 py-2.5 text-[11px] leading-relaxed text-gray-500">
                Mức độ cao hơn cho câu trả lời kỹ lưỡng hơn, nhưng mất nhiều thời gian
                hơn và tốn hạn mức nhanh hơn.
              </p>

              <div className="space-y-0.5 border-t border-gray-100 p-1.5">
                {EFFORT_LEVELS.map((item) => {
                  const selected = item.key === config.effort;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      onClick={() => {
                        onChange({ effort: item.key });
                        setView("main");
                      }}
                      className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] transition-colors ${selected
                          ? "bg-indigo-50 font-semibold text-indigo-900"
                          : "font-medium text-gray-700 hover:bg-gray-50"
                        }`}
                    >
                      <span>{item.label}</span>
                      <span className="flex items-center gap-2">
                        {item.isDefault && (
                          <span className="text-[11px] font-normal text-gray-400">
                            Mặc định
                          </span>
                        )}
                        {selected && <Check className="h-4 w-4 text-indigo-600" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
