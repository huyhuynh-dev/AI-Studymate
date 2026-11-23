"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { TextTarget } from "superdoc/ui";
import { useSuperDocUI } from "superdoc/ui/react";
import type { AgentStreamCursorTarget } from "../stream/browser-text-stream";

export interface LiveAgentTypingCaretHandle {
  updateCursor: (cursor: AgentStreamCursorTarget | null) => void;
  setStreaming: (isStreaming: boolean) => void;
}

interface LiveAgentTypingCaretProps {
  overlayContainerRef: React.RefObject<HTMLElement | null>;
  stageContainerRef: React.RefObject<HTMLElement | null>;
  agentLabel?: string;
  onAutoFollowScroll?: (nextScrollTop: number) => void;
}

const USER_SCROLL_GRACE_MS = 3000;
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

export const LiveAgentTypingCaret = React.memo(
  forwardRef<LiveAgentTypingCaretHandle, LiveAgentTypingCaretProps>(
    function LiveAgentTypingCaret(
      {
        overlayContainerRef,
        stageContainerRef,
        agentLabel = "Agent",
        onAutoFollowScroll,
      },
      ref,
    ) {
      const ui = useSuperDocUI();
      const caretElRef = useRef<HTMLDivElement | null>(null);
      const labelElRef = useRef<HTMLSpanElement | null>(null);

      const cursorTargetRef = useRef<AgentStreamCursorTarget | null>(null);
      const isStreamingRef = useRef(false);
      const hasCoordsRef = useRef(false);
      const lastUserScrollAtRef = useRef(0);
      const lastScrolledBlockIdRef = useRef<string | null>(null);
      const lingerTimerRef = useRef<number | null>(null);
      const rafIdRef = useRef<number | null>(null);
      const onAutoFollowScrollRef = useRef(onAutoFollowScroll);
      onAutoFollowScrollRef.current = onAutoFollowScroll;

      const setCaretOpacity = useCallback((visible: boolean) => {
        const el = caretElRef.current;
        if (!el) return;
        el.style.opacity = visible ? "1" : "0";
      }, []);

      const measureAndFollow = useCallback(() => {
        const overlayHost = overlayContainerRef.current;
        const caretEl = caretElRef.current;
        const labelEl = labelElRef.current;
        const cursor = cursorTargetRef.current;
        if (!ui || !overlayHost || !caretEl || !cursor) {
          return;
        }

        const { charTarget, collapsedTarget } = buildCaretTargets(cursor);
        let resolvedLeft: number | null = null;
        let resolvedTop: number | null = null;
        let resolvedHeight = 20;
        let activeTarget: TextTarget = collapsedTarget;

        if (cursor.offset > 0) {
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
            resolvedHeight = Math.max(
              16,
              Math.min(32, firstRect.height || 20),
            );
            activeTarget = collapsedTarget;
          }
        }

        if (resolvedLeft === null || resolvedTop === null) {
          return;
        }

        hasCoordsRef.current = true;
        const hostWidth = overlayHost.clientWidth || 720;
        const flipLabelLeft = resolvedLeft > Math.max(180, hostWidth - 110);

        caretEl.style.transform = `translate3d(${Math.round(resolvedLeft)}px, ${Math.round(resolvedTop)}px, 0)`;
        caretEl.style.height = `${Math.round(resolvedHeight)}px`;
        if (isStreamingRef.current) {
          caretEl.style.opacity = "1";
        }
        if (labelEl) {
          if (flipLabelLeft) {
            labelEl.style.left = "auto";
            labelEl.style.right = "6px";
          } else {
            labelEl.style.right = "auto";
            labelEl.style.left = "6px";
          }
        }

        const stageEl = stageContainerRef.current;
        if (
          isStreamingRef.current &&
          stageEl &&
          Date.now() - lastUserScrollAtRef.current > USER_SCROLL_GRACE_MS
        ) {
          const clientRes = ui.viewport.getRect({ target: activeTarget });
          if (clientRes.found && clientRes.rects.length > 0) {
            const caretClientRect = clientRes.rects[clientRes.rects.length - 1];
            const stageClientRect = stageEl.getBoundingClientRect();
            const isNewBlock = lastScrolledBlockIdRef.current !== cursor.blockId;

            if (isNewBlock) {
              lastScrolledBlockIdRef.current = cursor.blockId;
              const outAbove = caretClientRect.top < stageClientRect.top + 48;
              const outBelow =
                caretClientRect.bottom > stageClientRect.bottom - 56;
              if (outAbove || outBelow) {
                const targetTop = Math.max(
                  0,
                  stageEl.scrollTop +
                    (caretClientRect.top - stageClientRect.top) -
                    stageClientRect.height * 0.35,
                );
                stageEl.scrollTo({ top: targetTop, behavior: "smooth" });
                onAutoFollowScrollRef.current?.(targetTop);
                return;
              }
            }

            if (caretClientRect.bottom > stageClientRect.bottom - 56) {
              const delta =
                caretClientRect.bottom - (stageClientRect.bottom - 64);
              if (delta > 0) {
                const nextTop = stageEl.scrollTop + delta;
                stageEl.scrollTop = nextTop;
                onAutoFollowScrollRef.current?.(nextTop);
              }
            } else if (caretClientRect.top < stageClientRect.top + 48) {
              const delta = stageClientRect.top + 56 - caretClientRect.top;
              if (delta > 0) {
                const nextTop = Math.max(0, stageEl.scrollTop - delta);
                stageEl.scrollTop = nextTop;
                onAutoFollowScrollRef.current?.(nextTop);
              }
            }
          }
        }
      }, [ui, overlayContainerRef, stageContainerRef]);

      const scheduleMeasure = useCallback(() => {
        if (rafIdRef.current !== null) return;
        rafIdRef.current = window.requestAnimationFrame(() => {
          rafIdRef.current = null;
          measureAndFollow();
        });
      }, [measureAndFollow]);

      useImperativeHandle(
        ref,
        () => ({
          updateCursor(cursor) {
            cursorTargetRef.current = cursor;
            if (!cursor) {
              hasCoordsRef.current = false;
              lastScrolledBlockIdRef.current = null;
              setCaretOpacity(false);
              return;
            }
            if (isStreamingRef.current) {
              if (lingerTimerRef.current !== null) {
                window.clearTimeout(lingerTimerRef.current);
                lingerTimerRef.current = null;
              }
              setCaretOpacity(true);
            }
            scheduleMeasure();
          },
          setStreaming(streaming) {
            isStreamingRef.current = streaming;
            if (lingerTimerRef.current !== null) {
              window.clearTimeout(lingerTimerRef.current);
              lingerTimerRef.current = null;
            }

            if (streaming) {
              if (cursorTargetRef.current) {
                setCaretOpacity(true);
                scheduleMeasure();
              }
              return;
            }

            lastScrolledBlockIdRef.current = null;
            if (hasCoordsRef.current) {
              lingerTimerRef.current = window.setTimeout(() => {
                setCaretOpacity(false);
                lingerTimerRef.current = null;
              }, CARET_LINGER_MS);
            } else {
              setCaretOpacity(false);
            }
          },
        }),
        [scheduleMeasure, setCaretOpacity],
      );

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

      useEffect(() => {
        if (!ui) return undefined;
        return ui.viewport.observe(() => {
          if (cursorTargetRef.current && isStreamingRef.current) {
            scheduleMeasure();
          }
        });
      }, [ui, scheduleMeasure]);

      useEffect(() => {
        return () => {
          if (lingerTimerRef.current !== null) {
            window.clearTimeout(lingerTimerRef.current);
          }
          if (rafIdRef.current !== null) {
            window.cancelAnimationFrame(rafIdRef.current);
          }
        };
      }, []);

      return (
        <div
          ref={caretElRef}
          aria-hidden="true"
          data-v2-remote-caret="studymate-agent"
          className="pointer-events-none absolute left-0 top-0 z-30 select-none"
          style={{
            opacity: 0,
            transform: "translate3d(-9999px, -9999px, 0)",
            height: "20px",
            width: "2px",
            backgroundColor: "#8B5CF6",
            boxShadow: "0 0 6px rgba(139, 92, 246, 0.45)",
            willChange: "transform, opacity",
            transition:
              "transform 42ms cubic-bezier(0.22, 1, 0.36, 1), height 60ms ease, opacity 240ms ease",
          }}
        >
          <span
            ref={labelElRef}
            data-v2-remote-label="studymate-agent"
            className="absolute -top-0.5 whitespace-nowrap rounded-[5px] bg-[#8B5CF6] px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white shadow-sm"
            style={{ left: "6px" }}
          >
            {agentLabel}
          </span>
        </div>
      );
    },
  ),
);
