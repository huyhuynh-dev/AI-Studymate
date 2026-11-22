import { useEffect, useRef, useState } from "react";
import type { ContentControlTarget } from "superdoc/ui";
import { useSuperDocHost, useSuperDocUI } from "superdoc/ui/react";
import { useSelectionFormatting } from "./useSelectionFormatting";
import { applyDocumentSelection, runDocumentAction } from "./documentActions";
import { isContentLocked } from "./contentControlSelection";

function matchFormattingShortcut(
  event: KeyboardEvent,
): { command: string; payload?: unknown } | null {
  if (!(event.metaKey || event.ctrlKey)) return null;
  const key = event.code.startsWith("Key")
    ? event.code.slice(3).toLowerCase()
    : event.key.toLowerCase();

  if (event.altKey) {
    return !event.shiftKey && key === "c"
      ? { command: "clear-formatting" }
      : null;
  }
  if (!event.shiftKey && (key === "b" || key === "i" || key === "u")) {
    const map: Record<string, string> = {
      b: "bold",
      i: "italic",
      u: "underline",
    };
    return { command: map[key] };
  }
  if (event.shiftKey && key === "x") return { command: "strikethrough" };
  if (event.shiftKey && key === "h") {
    return { command: "highlight-color", payload: "#fff200" };
  }
  if (event.code === "Equal") {
    return { command: event.shiftKey ? "superscript" : "subscript" };
  }
  return null;
}

/**
 * Phím tắt định dạng (Ctrl+B/I/U/Shift+X/Shift+H/Alt+C/=) dùng chung mutation planner
 * với toolbar và giữ nguyên hành vi bộ gõ tiếng Việt (không chặn khi `isComposing`).
 */
export function WordFormattingShortcuts() {
  const ui = useSuperDocUI();
  const host = useSuperDocHost();
  const formatting = useSelectionFormatting();
  const latestRef = useRef(formatting);
  const [error, setError] = useState("");

  useEffect(() => {
    latestRef.current = formatting;
  }, [formatting]);

  useEffect(() => {
    if (!ui) return;

    const selectLockedControl = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        latestRef.current.readOnly ||
        !(event.target instanceof Element) ||
        !ui.viewport.getHost()?.contains(event.target)
      ) {
        return;
      }

      const doc = host?.activeEditor?.doc;
      const hit = ui.viewport
        .entityAt({ x: event.clientX, y: event.clientY })
        .find((entity) => entity.type === "contentControl");
      if (!hit || !doc?.selection?.current || !doc.contentControls?.get) return;

      const readSelection = doc.selection.current.bind(doc.selection);
      const getControl = doc.contentControls.get.bind(doc.contentControls);
      const target: ContentControlTarget = {
        kind: hit.scope ?? "inline",
        nodeType: "sdt",
        nodeId: hit.id,
        ...(hit.story
          ? { story: hit.story as ContentControlTarget["story"] }
          : {}),
      };

      void runDocumentAction(doc, async () => {
        const selection = await readSelection();
        const range = selection.selectionTarget;
        if (
          !selection.empty &&
          range?.start.kind === "text" &&
          range.end.kind === "text" &&
          (range.start.blockId !== range.end.blockId ||
            range.start.offset !== range.end.offset)
        ) {
          return;
        }
        const control = await getControl({ target });
        if (!isContentLocked(control) || !control.selectionTarget) return;
        await applyDocumentSelection(doc, ui, control.selectionTarget);
      }).catch(() => setError("Không thể chọn vùng kiểm soát nội dung này."));
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || !(event.target instanceof Element)) return;
      const editorHost = ui.viewport.getHost();
      if (!editorHost?.contains(event.target)) return;
      if (
        event.target.closest(
          'input, select, textarea, [contenteditable="true"]',
        ) &&
        !event.target.closest('[data-v2-ime-host="true"]')
      ) {
        return;
      }

      const match = matchFormattingShortcut(event);
      if (!match || latestRef.current.readOnly) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat) return;

      setError("");
      void latestRef.current
        .execute(match.command, match.payload)
        .catch(() =>
          setError("Không thể áp dụng định dạng cho vùng chọn này."),
        );
    };

    window.document.addEventListener("keydown", handleKeyDown, true);
    window.document.addEventListener("pointerup", selectLockedControl);
    return () => {
      window.document.removeEventListener("keydown", handleKeyDown, true);
      window.document.removeEventListener("pointerup", selectLockedControl);
    };
  }, [host, ui]);

  if (!error) return null;

  return (
    <div className="sd-toolbar-status" role="status" aria-live="polite">
      <span>{error}</span>
      <button
        type="button"
        aria-label="Đóng thông báo phím tắt"
        onClick={() => setError("")}
      >
        ×
      </button>
    </div>
  );
}
