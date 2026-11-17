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
