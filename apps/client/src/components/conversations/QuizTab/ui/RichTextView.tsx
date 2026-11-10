"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { cx, stripHtml } from "../utils";

/** Hiển thị HTML rich-text (đã qua TipTap) an toàn bằng DOMPurify. */
export function RichTextView({ html, className }: { html?: string | null; className?: string }) {
  const clean = useMemo(() => {
    if (!html) return "";
    if (typeof window === "undefined") return stripHtml(html); // SSR: chỉ hiển thị text thuần
    return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  }, [html]);
  if (!clean) return null;
  return <div className={cx("qz-prose", className)} dangerouslySetInnerHTML={{ __html: clean }} />;
}
