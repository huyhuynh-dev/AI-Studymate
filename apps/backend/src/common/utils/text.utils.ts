/**
 * Loại bỏ các thẻ HTML cơ bản và chuẩn hóa khoảng trắng về văn bản thuần.
 */
export function stripHtml(html?: string | null): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chuyển HTML giàu định dạng (TipTap Flashcard/Quiz) sang văn bản thuần có cấu trúc dòng gọn,
 * giữ nguyên cú pháp Cloze `{{...}}` và cắt ngắn an toàn ở giới hạn ký tự.
 */
export function htmlToCleanText(
  html?: string | null,
  maxChars?: number,
): string {
  if (!html) return '';

  const withLineBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<t[dh]\b[^>]*>/gi, ' ')
    .replace(/<\/?(strong|b|em|i|u|s|strike|code|span|mark|a|sub|sup)\b[^>]*>/gi, '')
    .replace(/<[^>]*>/g, ' ');

  const decoded = withLineBreaks
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");

  const normalized = decoded
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (
    typeof maxChars === 'number' &&
    maxChars > 1 &&
    normalized.length > maxChars
  ) {
    return `${normalized.slice(0, maxChars - 1).trimEnd()}…`;
  }

  return normalized;
}

/**
 * Chuẩn hóa danh sách tiêu chí chấm điểm hoặc các ý bị thiếu từ cột JSONB PostgreSQL.
 */
export function parseGradingCriteria(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === 'string')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Chuẩn hóa tiêu đề mục lục hoặc cụm ý kiến thức để so khớp/gom nhóm không phân biệt hoa thường hay dấu câu thừa.
 */
export function normalizeHeadingKey(text?: string | null): string {
  if (!text) return '';
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/^[#*\-\s]+/, '')
    .replace(/[.,;:!?'"“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
