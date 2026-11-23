import { useCallback, useRef } from "react";
import type { SelectionCapture } from "superdoc/ui";
import { useSuperDocHost, useSuperDocUI } from "superdoc/ui/react";
import {
  restoreDocumentSelection,
  waitForDocumentAction,
} from "./documentActions";

export function computeClampedMenuPosition(
  trigger: HTMLButtonElement,
  menuWidth: number,
  estimatedHeight = 280,
): { left: number; top: number } {
  const bounds = trigger.getBoundingClientRect();
  const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8);
  const left = Math.max(8, Math.min(bounds.left, maxLeft));

  const spaceBelow = window.innerHeight - bounds.bottom - 8;
  const shouldOpenAbove =
    spaceBelow < Math.min(estimatedHeight, 200) && bounds.top > spaceBelow;
  const top = shouldOpenAbove
    ? Math.max(8, bounds.top - Math.min(estimatedHeight, bounds.top - 12))
    : Math.max(8, bounds.bottom + 4);

  return { left, top };
}

export function getMenuPortalTarget(): HTMLElement | null {
  if (typeof window === "undefined") return null;
  return (window.document.fullscreenElement as HTMLElement | null) ?? window.document.body;
}

/**
 * Dùng chung cơ chế capture & restore vùng chọn cho mọi menu/dropdown trên toolbar:
 * ghi lại selection trước khi DOM chuyển focus sang menu và chờ worker xác nhận lại range.
 */
export function useToolbarMenuCapture() {
  const ui = useSuperDocUI();
  const host = useSuperDocHost();
  const captureRef = useRef<SelectionCapture | null>(null);

  const preserveSelection = useCallback(() => {
    captureRef.current = ui?.selection.capture() ?? null;
  }, [ui]);

  const clearCapturedSelection = useCallback(() => {
    captureRef.current = null;
  }, []);

  const restoreSelection = useCallback(async () => {
    const capture = captureRef.current;
    captureRef.current = null;
    const doc = host?.activeEditor?.doc;
    if (capture && ui && doc) {
      await waitForDocumentAction(doc);
      await restoreDocumentSelection(doc, ui, capture);
    }
    return capture;
  }, [host, ui]);

  return {
    preserveSelection,
    clearCapturedSelection,
    restoreSelection,
  };
}
