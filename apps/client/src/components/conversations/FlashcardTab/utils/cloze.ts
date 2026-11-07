export type ClozeSegment = { kind: "text" | "blank"; value: string };

const CLOZE_RE = /\{\{(.+?)\}\}/g;

/** [LEGACY] Tách câu text thuần thành đoạn chữ và chỗ trống ({{từ khóa}}). Dữ liệu mới là HTML — xem richtext/. */
export function parseCloze(text: string): ClozeSegment[] {
  const out: ClozeSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(CLOZE_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ kind: "text", value: text.slice(last, i) });
    out.push({ kind: "blank", value: m[1] });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}

/** Có chỗ trống không? Nhận cả HTML mới (<span data-cloze>) lẫn cú pháp cũ {{...}} */
export const hasCloze = (text: string) => /<span[^>]*\bdata-cloze\b/.test(text) || /\{\{.+?\}\}/.test(text);

/** [LEGACY] Dùng richToPlain() từ richtext/ cho dữ liệu mới */
export const clozeToPlain = (text: string) => text.replace(CLOZE_RE, "[$1]");
