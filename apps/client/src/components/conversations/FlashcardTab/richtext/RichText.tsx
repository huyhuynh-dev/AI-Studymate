"use client";

import { useMemo } from "react";
import { cx } from "../ui";
import { hideCloze, toRichHtml } from "./convert";
import { sanitizeRich } from "./sanitize";
import type { FormatId } from "./schema";
import { ALIGN_CENTER, CLOZE_CHIP, CLOZE_MODES, RICH_CONTENT } from "./styles";

export type ClozeMode = "hidden" | "revealed" | "marked";

interface Props {
  /** HTML từ editor HOẶC text thuần dữ liệu cũ — component tự chuẩn hoá */
  html: string;
  /** Có truyền → coi đây là thẻ điền khuyết (đồng thời đọc được cú pháp {{...}} cũ) */
  clozeMode?: ClozeMode;
  align?: "left" | "center";
  /** Giới hạn allowlist (mặc định: toàn bộ định dạng) */
  formats?: FormatId[];
  className?: string;
}

/** Hiển thị nội dung rich text (CardRow xem trước, thẻ học…). Luôn sanitize trước khi render. */
export function RichText({ html, clozeMode, align = "left", formats, className }: Props) {
  const safe = useMemo(() => {
    const out = sanitizeRich(toRichHtml(html, { legacyCloze: !!clozeMode }), formats);
    return clozeMode === "hidden" ? hideCloze(out) : out;
  }, [html, clozeMode, formats]);

  return (
    <div
      data-cloze-mode={clozeMode}
      className={cx(RICH_CONTENT, CLOZE_CHIP, CLOZE_MODES, align === "center" && ALIGN_CENTER, className)}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
