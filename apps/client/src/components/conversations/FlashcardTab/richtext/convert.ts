import { CLOZE_SELECTOR, ROOT_BLOCK_RE } from "./schema";

/** Cú pháp cloze cũ (text thuần): {{từ khóa}} */
const CLOZE_LEGACY_RE = /\{\{(.+?)\}\}/g;

export const isRichHtml = (s: string) => ROOT_BLOCK_RE.test(s);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Dữ liệu cũ (text thuần, xuống dòng bằng \n) → HTML. `legacyCloze` đổi {{x}} thành chỗ trống mới. */
export function plainToHtml(text: string, opts?: { legacyCloze?: boolean }): string {
  if (!text) return "";
  return text
    .split(/\r?\n/)
    .map((line) => {
      let h = esc(line);
      if (opts?.legacyCloze) h = h.replace(CLOZE_LEGACY_RE, '<span data-cloze="true">$1</span>');
      return `<p>${h}</p>`;
    })
    .join("");
}

/** Chấp nhận cả HTML lẫn text thuần → luôn trả về HTML (đầu vào chuẩn của editor / renderer) */
export const toRichHtml = (raw: string, opts?: { legacyCloze?: boolean }) =>
  isRichHtml(raw) ? raw : plainToHtml(raw, opts);

/** Parse HTML vào template (inert: không chạy script, không tải ảnh) */
function fragment(html: string): DocumentFragment {
  const t = document.createElement("template");
  t.innerHTML = html;
  return t.content;
}

/** Văn bản thuần để hiển thị trong danh sách / tìm kiếm. Chỗ trống → [từ khóa]. */
export function richToPlain(raw: string): string {
  if (!raw) return "";
  if (!isRichHtml(raw)) return raw.replace(CLOZE_LEGACY_RE, "[$1]");
  if (typeof document === "undefined") {
    return raw.replace(/<\/(p|li)>/gi, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }
  const frag = fragment(raw);
  frag.querySelectorAll(CLOZE_SELECTOR).forEach((el) => (el.textContent = `[${el.textContent}]`));
  frag.querySelectorAll("p,li").forEach((el) => el.append(" "));
  return (frag.textContent ?? "").replace(/\s+/g, " ").trim();
}

export const isRichEmpty = (raw: string) => richToPlain(raw).length === 0;

/** Chế độ "ẩn": thay nội dung chỗ trống bằng [ … ] (dùng regex nên cũng an toàn khi SSR — không lộ đáp án) */
export const hideCloze = (html: string) =>
  html.replace(/(<span[^>]*\bdata-cloze\b[^>]*>)[\s\S]*?(<\/span>)/g, "$1[ … ]$2");
