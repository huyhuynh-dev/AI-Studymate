export const UNTITLED_NOTE_LABEL = "Ghi chú không có tiêu đề";
export const EMPTY_NOTE_PREVIEW = "Trang ghi chú trống — nhấn để bắt đầu viết…";

export function getNoteDisplayTitle(title: string | null | undefined): string {
  const trimmed = typeof title === "string" ? title.trim() : "";
  return trimmed || UNTITLED_NOTE_LABEL;
}

function collectBlockInlineText(content: unknown, parts: string[]): void {
  if (typeof content === "string") {
    if (content.trim()) parts.push(content.trim());
    return;
  }

  if (!Array.isArray(content)) return;

  for (const item of content) {
    if (typeof item === "string") {
      if (item.trim()) parts.push(item.trim());
    } else if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      if (typeof record.text === "string" && record.text.trim()) {
        parts.push(record.text.trim());
      } else if (typeof record.content === "string" && record.content.trim()) {
        parts.push(record.content.trim());
      }
    }
  }
}

/**
 * Trích xuất đoạn text ngắn từ BlockNote JSON để làm preview cho thẻ ghi chú.
 */
export function extractNotePreviewText(contentJson: unknown[]): string {
  if (!Array.isArray(contentJson) || contentJson.length === 0) {
    return EMPTY_NOTE_PREVIEW;
  }

  const parts: string[] = [];

  for (const block of contentJson) {
    if (!block || typeof block !== "object") continue;
    const record = block as Record<string, unknown>;

    collectBlockInlineText(record.content, parts);

    if (parts.join(" ").length >= 160) {
      break;
    }
  }

  const fullText = parts.join(" ").trim();
  if (!fullText) return EMPTY_NOTE_PREVIEW;
  return fullText.length > 160 ? `${fullText.slice(0, 157)}...` : fullText;
}
