"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { TextTarget } from "superdoc/ui";
import { useSuperDocUI } from "superdoc/ui/react";
import type { AgentStreamCursorTarget } from "../stream/browser-text-stream";

interface LiveAgentTypingCaretProps {
  overlayContainerRef: React.RefObject<HTMLElement | null>;
  stageContainerRef: React.RefObject<HTMLElement | null>;
  cursorTarget: AgentStreamCursorTarget | null;
  isStreaming: boolean;
  agentLabel?: string;
  onAutoFollowScroll?: (nextScrollTop: number) => void;
}

interface CaretCoords {
  left: number;
  top: number;
  height: number;
  flipLabelLeft: boolean;
}

const USER_SCROLL_GRACE_MS = 2500;
const CARET_LINGER_MS = 650;

function buildCaretTargets(cursor: AgentStreamCursorTarget): {
  charTarget: TextTarget;
  collapsedTarget: TextTarget;
} {
  const storyPart = cursor.story ? { story: cursor.story as never } : {};
  const charTarget: TextTarget = {
    kind: "text",
    segments: [
      {
        blockId: cursor.blockId,
        range: {
          start: Math.max(0, cursor.offset - 1),
          end: cursor.offset,
        },
      },
    ],
    ...storyPart,
  };
  const collapsedTarget: TextTarget = {
    kind: "text",
    segments: [
      {
        blockId: cursor.blockId,
        range: {
          start: cursor.offset,
          end: cursor.offset,
        },
      },
    ],
    ...storyPart,
  };
  return { charTarget, collapsedTarget };
}

export function LiveAgentTypingCaret({
  overlayContainerRef,
  stageContainerRef,
  cursorTarget,
  isStreaming,
  agentLabel = "Agent",
  onAutoFollowScroll,
}: LiveAgentTypingCaretProps) {
  const ui = useSuperDocUI();
  const [coords, setCoords] = useState<CaretCoords | null>(null);
  const [visible, setVisible] = useState(false);
  const lastUserScrollAtRef = useRef(0);
  const lingerTimerRef = useRef<number | null>(null);

  // Ghi nhận khi người dùng chủ động cuộn chuột/chạm để không tự ý giằng thanh cuộn
  useEffect(() => {
    const stageEl = stageContainerRef.current;
    if (!stageEl) return undefined;

    const markUserScroll = () => {
      lastUserScrollAtRef.current = Date.now();
    };

    stageEl.addEventListener("wheel", markUserScroll, { passive: true });
    stageEl.addEventListener("touchmove", markUserScroll, { passive: true });
    return () => {
      stageEl.removeEventListener("wheel", markUserScroll);
      stageEl.removeEventListener("touchmove", markUserScroll);
    };
  }, [stageContainerRef]);

  // Giữ con trỏ hiển thị thêm 650ms sau khi gõ xong rồi mới mờ dần
  useEffect(() => {
    if (lingerTimerRef.current !== null) {
      window.clearTimeout(lingerTimerRef.current);
      lingerTimerRef.current = null;
    }

    if (isStreaming && cursorTarget) {
      setVisible(true);
      return undefined;
    }

    if (!isStreaming && coords) {
      lingerTimerRef.current = window.setTimeout(() => {
        setVisible(false);
        lingerTimerRef.current = null;
      }, CARET_LINGER_MS);
      return () => {
        if (lingerTimerRef.current !== null) {
          window.clearTimeout(lingerTimerRef.current);
          lingerTimerRef.current = null;
        }
      };
    }

    if (!cursorTarget) {
      setVisible(false);
      setCoords(null);
    }

    return undefined;
  }, [isStreaming, cursorTarget, coords]);

  const measureAndFollow = useCallback(() => {
    const overlayHost = overlayContainerRef.current;
    if (!ui || !overlayHost || !cursorTarget) {
      return;
    }

    const { charTarget, collapsedTarget } = buildCaretTargets(cursorTarget);
    let resolvedLeft: number | null = null;
    let resolvedTop: number | null = null;
    let resolvedHeight = 20;
    let activeTarget: TextTarget = collapsedTarget;

    if (cursorTarget.offset > 0) {
      const charRes = ui.viewport.getRect({
        target: charTarget,
        relativeTo: overlayHost,
      });
      if (charRes.found && charRes.rects.length > 0) {
        const lastRect = charRes.rects[charRes.rects.length - 1];
        resolvedLeft = lastRect.right;
        resolvedTop = lastRect.top;
        resolvedHeight = Math.max(16, Math.min(32, lastRect.height || 20));
        activeTarget = charTarget;
      }
    }

    if (resolvedLeft === null || resolvedTop === null) {
      const collapsedRes = ui.viewport.getRect({
        target: collapsedTarget,
        relativeTo: overlayHost,
      });
      if (collapsedRes.found && collapsedRes.rects.length > 0) {
        const firstRect = collapsedRes.rects[0];
        resolvedLeft = firstRect.left;
        resolvedTop = firstRect.top;
        resolvedHeight = Math.max(16, Math.min(32, firstRect.height || 20));
        activeTarget = collapsedTarget;
      }
    }

    if (resolvedLeft === null || resolvedTop === null) {
      return;
    }

    const hostWidth = overlayHost.clientWidth || 720;
    const flipLabelLeft = resolvedLeft > Math.max(180, hostWidth - 110);

    setCoords({
      left: resolvedLeft,
      top: resolvedTop,
      height: resolvedHeight,
      flipLabelLeft,
    });

    // Smart Bottom Auto-Follow: chỉ trượt nhẹ xuống khi dòng AI đang gõ vượt quá mép dưới khung nhìn
    const stageEl = stageContainerRef.current;
    if (
      isStreaming &&
      stageEl &&
      Date.now() - lastUserScrollAtRef.current > USER_SCROLL_GRACE_MS
    ) {
      const clientRes = ui.viewport.getRect({ target: activeTarget });
      if (clientRes.found && clientRes.rects.length > 0) {
        const caretClientRect = clientRes.rects[clientRes.rects.length - 1];
        const stageClientRect = stageEl.getBoundingClientRect();
        if (caretClientRect.bottom > stageClientRect.bottom - 56) {
          const delta = caretClientRect.bottom - (stageClientRect.bottom - 64);
          if (delta > 0) {
            const nextTop = stageEl.scrollTop + delta;
            stageEl.scrollTop = nextTop;
            onAutoFollowScroll?.(nextTop);
          }
        }
      }
    }
  }, [
    ui,
    overlayContainerRef,
    stageContainerRef,
    cursorTarget,
    isStreaming,
    onAutoFollowScroll,
  ]);

  useEffect(() => {
    measureAndFollow();
  }, [measureAndFollow]);

  useEffect(() => {
    if (!ui || !cursorTarget) return undefined;
    return ui.viewport.observe(() => {
      measureAndFollow();
    });
  }, [ui, cursorTarget, measureAndFollow]);

  if (!coords) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      data-v2-remote-caret="studymate-agent"
      className="pointer-events-none absolute left-0 top-0 z-30 select-none transition-opacity duration-300"
      style={{
        opacity: visible ? 1 : 0,
        transform: `translate3d(${Math.round(coords.left)}px, ${Math.round(coords.top)}px, 0)`,
        height: `${Math.round(coords.height)}px`,
        width: "2px",
        backgroundColor: "#8B5CF6",
        boxShadow: "0 0 6px rgba(139, 92, 246, 0.45)",
        transition:
          "transform 45ms linear, height 60ms ease, opacity 280ms ease",
      }}
    >
      <span
        data-v2-remote-label="studymate-agent"
        className="absolute -top-0.5 whitespace-nowrap rounded-[5px] bg-[#8B5CF6] px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white shadow-sm"
        style={
          coords.flipLabelLeft
            ? { right: "6px" }
            : { left: "6px" }
        }
      >
        {agentLabel}
      </span>
    </div>
  );
}
