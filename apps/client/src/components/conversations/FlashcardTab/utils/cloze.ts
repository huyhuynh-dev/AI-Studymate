export type ClozeSegment = { kind: "text" | "blank"; value: string };

const CLOZE_RE = /\{\{(.+?)\}\}/g;

/** Tách câu thành các đoạn chữ thường và chỗ trống ({{từ khóa}}) */
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

export const hasCloze = (text: string) => /\{\{.+?\}\}/.test(text);
export const clozeToPlain = (text: string) => text.replace(CLOZE_RE, "[$1]");
