"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  Languages,
  Send,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { useSuperDocUI } from "superdoc/ui/react";
import {
  useWordAgent,
  type WordAgentSelectionAction,
} from "@/contexts/WordAgentContext";

interface WordSelectionAiPillProps {
  overlayContainerRef: React.RefObject<HTMLElement | null>;
}

interface PillCoords {
  top: number;
  left: number;
  quotedText: string;
}

const QUICK_ACTIONS: Array<{
  action: Exclude<WordAgentSelectionAction, "custom">;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { action: "rewrite", label: "Viết lại hay hơn", icon: Wand2 },
  { action: "fix-grammar", label: "Sửa chính tả & ngữ pháp", icon: Check },
  { action: "expand", label: "Mở rộng ý chi tiết", icon: BookOpen },
  { action: "summarize", label: "Cô đọng súc tích", icon: Sparkles },
  { action: "translate-en", label: "Dịch sang tiếng Anh", icon: Languages },
];

export const WordSelectionAiPill = React.memo(function WordSelectionAiPill({
  overlayContainerRef,
}: WordSelectionAiPillProps) {
  const ui = useSuperDocUI();
  const { updateSelection, clearSelection, triggerQuickPrompt } = useWordAgent();

  const [pillCoords, setPillCoords] = useState<PillCoords | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");
  const containerClickedInsideRef = useRef(false);
  const pillRef = useRef<HTMLDivElement | null>(null);

  const computeCoords = useCallback(
    (quotedText: string): PillCoords | null => {
      if (!ui || !overlayContainerRef.current) return null;
      const host = overlayContainerRef.current;
      const rects = ui.selection.getRects({ relativeTo: host });
      if (!rects || rects.length === 0) return null;

      const firstRect = rects[0];
      const hostWidth = host.clientWidth || 720;
      const clampedLeft = Math.max(
        12,
        Math.min(firstRect.left, Math.max(12, hostWidth - 260)),
      );
      const top = Math.max(8, firstRect.top - 42);
      return { top, left: clampedLeft, quotedText };
    },
    [ui, overlayContainerRef],
  );

  useEffect(() => {
    const host = overlayContainerRef.current;
    if (!host) return undefined;

    const handlePointerDown = () => {
      containerClickedInsideRef.current = true;
    };

    host.addEventListener("pointerdown", handlePointerDown);
    return () => {
      host.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [overlayContainerRef]);

  useEffect(() => {
    if (!ui) return undefined;

    return ui.selection.subscribe(({ snapshot }) => {
      if (snapshot.status !== "ready") {
        return;
      }

      const trimmed = snapshot.quotedText.trim();
      if (!snapshot.empty && trimmed.length >= 2) {
        updateSelection(trimmed);
        const coords = computeCoords(trimmed);
        if (coords) {
          setPillCoords(coords);
        }
        containerClickedInsideRef.current = false;
        return;
      }

      setPillCoords(null);
      setIsMenuOpen(false);
      if (containerClickedInsideRef.current) {
        clearSelection();
        containerClickedInsideRef.current = false;
      }
    });
  }, [ui, computeCoords, updateSelection, clearSelection]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && pillRef.current?.contains(target)) {
        return;
      }
      setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const handleQuickAction = useCallback(
    (action: Exclude<WordAgentSelectionAction, "custom">) => {
      if (!pillCoords) return;
      triggerQuickPrompt({
        action,
        selectedTextOverride: pillCoords.quotedText,
        autoSend: true,
      });
      setIsMenuOpen(false);
      setPillCoords(null);
    },
    [pillCoords, triggerQuickPrompt],
  );

  const handleSubmitCustom = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (!pillCoords || !customInstruction.trim()) return;
      triggerQuickPrompt({
        action: "custom",
        customInstruction: customInstruction.trim(),
        selectedTextOverride: pillCoords.quotedText,
        autoSend: true,
      });
      setCustomInstruction("");
      setIsMenuOpen(false);
      setPillCoords(null);
    },
    [pillCoords, customInstruction, triggerQuickPrompt],
  );

  if (!pillCoords) return null;

  return (
    <div
      ref={pillRef}
      style={{ top: pillCoords.top, left: pillCoords.left }}
      className="absolute z-40 select-none"
    >
      <div className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-white/95 dark:bg-[#1a1f2e]/95 backdrop-blur-md shadow-lg px-2.5 py-1">
        <button
          type="button"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Chỉnh sửa với AI
        </button>
        <button
          type="button"
          onClick={() => {
            setPillCoords(null);
            setIsMenuOpen(false);
          }}
          aria-label="Ẩn nút AI"
          className="rounded-full p-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      {isMenuOpen && (
        <div className="mt-1.5 w-72 rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#171b26]/95 backdrop-blur-md shadow-2xl p-2 text-[12.5px]">
          <form onSubmit={handleSubmitCustom} className="flex items-center gap-1.5 pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
            <input
              type="text"
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder="Yêu cầu AI cho đoạn đang chọn..."
              className="flex-1 min-w-0 rounded-lg border border-black/[0.08] dark:border-white/[0.12] bg-black/[0.025] dark:bg-white/[0.05] px-2.5 py-1.5 text-[12px] text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            <button
              type="submit"
              disabled={!customInstruction.trim()}
              aria-label="Gửi yêu cầu cho AI"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 cursor-pointer shrink-0"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </form>

          <div className="pt-1.5 flex flex-col gap-0.5">
            {QUICK_ACTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.action}
                  type="button"
                  onClick={() => handleQuickAction(item.action)}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-neutral-700 dark:text-neutral-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/15 hover:text-indigo-700 dark:hover:text-indigo-200 transition-colors cursor-pointer"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
