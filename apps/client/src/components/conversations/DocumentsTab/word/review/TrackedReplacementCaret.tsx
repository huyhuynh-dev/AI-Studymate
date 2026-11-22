"use client";

import { useEffect } from "react";
import type { DocumentMode } from "superdoc";
import { useSuperDocUI } from "superdoc/ui/react";

interface TrackedReplacementCaretProps {
  stageContainerRef: React.RefObject<HTMLElement | null>;
  documentMode: DocumentMode;
  disabled?: boolean;
}

/**
 * Chuẩn hóa vùng chọn `tracked` sang tọa độ `visible` ngay trước khi người dùng
 * gõ phím thay thế trong chế độ Đề xuất (port từ canonical-collaboration-demo).
 * Ngăn lỗi chữ mới bị chèn tách đôi quanh phần đã bị đánh dấu xóa trước đó.
 */
export function TrackedReplacementCaret({
  stageContainerRef,
  documentMode,
  disabled = false,
}: TrackedReplacementCaretProps) {
  const ui = useSuperDocUI();

  useEffect(() => {
    const root = stageContainerRef.current;
    if (!root || !ui) return undefined;

    let lastSource: string | undefined;
    let disposed = false;

    const isEnabled = () => !disabled && documentMode === "suggesting";
    const cancel = () => {
      lastSource = undefined;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (disposed || !isEnabled()) return;
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        Array.from(event.key).length !== 1
      ) {
        cancel();
        return;
      }

      const host = (event.target as Element | null)?.closest("[data-v2-ime-host]");
      if (!host || !root.contains(host)) {
        cancel();
        return;
      }

      const snapshot = ui.selection.getSnapshot();
      const target = snapshot.selectionTarget;
      const visible = snapshot.target;
      if (snapshot.status !== "ready") return;
      if (snapshot.empty || target?.coordinateSpace !== "tracked") {
        cancel();
        return;
      }
      if (
        target.start.kind !== "text" ||
        target.end.kind !== "text" ||
        target.start.blockId !== target.end.blockId ||
        visible?.coordinateSpace === "tracked" ||
        visible?.segments.length !== 1
      ) {
        return;
      }

      const segment = visible.segments[0];
      if (
        segment.blockId !== target.start.blockId ||
        segment.range.end <= segment.range.start ||
        segment.range.end - segment.range.start !==
          target.end.offset - target.start.offset
      ) {
        return;
      }

      const sourceKey = JSON.stringify({ target, visible });
      if (sourceKey === lastSource) return;
      lastSource = sourceKey;

      const applied = ui.selection.apply({
        ...target,
        coordinateSpace: "visible",
        start: { ...target.start, offset: segment.range.start },
        end: { ...target.end, offset: segment.range.end },
      });
      if (!applied.ok) {
        cancel();
      }
    };

    const doc = root.ownerDocument;
    doc.addEventListener("keydown", handleKeyDown, true);
    doc.addEventListener("pointerdown", cancel, true);
    doc.addEventListener("compositionstart", cancel, true);
    doc.addEventListener("focusout", cancel, true);

    return () => {
      disposed = true;
      cancel();
      doc.removeEventListener("keydown", handleKeyDown, true);
      doc.removeEventListener("pointerdown", cancel, true);
      doc.removeEventListener("compositionstart", cancel, true);
      doc.removeEventListener("focusout", cancel, true);
    };
  }, [stageContainerRef, ui, documentMode, disabled]);

  return null;
}
