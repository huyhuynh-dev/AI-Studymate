import DOMPurify from "dompurify";
import { isRichEmpty } from "./convert";
import { ALL_FORMATS, BASE_TAGS, FORMAT_SCHEMA, type FormatId } from "./schema";

function policy(formats: FormatId[]) {
  const tags = new Set(BASE_TAGS);
  const attrs = new Set<string>();
  for (const f of formats) {
    FORMAT_SCHEMA[f].tags.forEach((t) => tags.add(t));
    FORMAT_SCHEMA[f].attrs?.forEach((a) => attrs.add(a));
  }
  return { ALLOWED_TAGS: [...tags], ALLOWED_ATTR: [...attrs], ALLOW_DATA_ATTR: false, KEEP_CONTENT: true };
}

const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Làm sạch HTML theo allowlist của các định dạng được truyền vào.
 * Thẻ không được phép bị gỡ nhưng GIỮ lại nội dung chữ (vd: cloze bị gỡ khi lưu thẻ Cơ bản).
 * Trên server (không có DOM) → trả về text thuần đã escape, tuyệt đối không trả HTML chưa lọc.
 */
export function sanitizeRich(html: string, formats: FormatId[] = ALL_FORMATS): string {
  if (!html) return "";
  if (typeof window === "undefined") {
    const text = html.replace(/<\/(p|li)>/gi, " ").replace(/<[^>]+>/g, "").trim();
    return text ? `<p>${escapeText(text)}</p>` : "";
  }
  return DOMPurify.sanitize(html, policy(formats));
}

/** Gọi ngay trước khi lưu: lọc + chuẩn hoá "rỗng" về chuỗi "" (thay vì <p></p>) */
export function finalizeRich(html: string, formats: FormatId[] = ALL_FORMATS): string {
  const clean = sanitizeRich(html, formats);
  return isRichEmpty(clean) ? "" : clean;
}
