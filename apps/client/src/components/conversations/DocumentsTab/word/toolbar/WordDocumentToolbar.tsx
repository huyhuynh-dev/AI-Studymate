import { memo, type CSSProperties } from "react";
import { SelectionFormattingProvider } from "./useSelectionFormatting";
import { WordFormattingControls } from "./WordFormattingControls";
import { WordFormattingShortcuts } from "./WordFormattingShortcuts";
import { WordStyleAndReviewControls } from "./WordStyleAndReviewControls";
import "./WordToolbar.css";

export interface WordDocumentToolbarProps {
  className?: string;
  style?: CSSProperties;
}

/**
 * Thanh công cụ React thuần cho Word Editor, chạy bên trong `<SuperDocUIProvider>`
 * để dùng chung một controller duy nhất và tránh xung đột focus với Vue toolbar.
 */
export const WordDocumentToolbar = memo(function WordDocumentToolbar({
  className = "",
  style,
}: WordDocumentToolbarProps) {
  return (
    <div
      className={`sd-word-toolbar-bar ${className}`.trim()}
      style={style}
      role="toolbar"
      aria-label="Thanh công cụ soạn thảo Word"
    >
      <SelectionFormattingProvider>
        <WordFormattingShortcuts />
        <div className="sd-word-toolbar-inner">
          <WordFormattingControls />
          <WordStyleAndReviewControls />
        </div>
      </SelectionFormattingProvider>
    </div>
  );
});
