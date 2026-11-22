export interface BubbleAiQuickPrompt {
  id: string;
  label: string;
  prompt: string;
}

export const BUBBLE_AI_QUICK_PROMPTS: BubbleAiQuickPrompt[] = [
  {
    id: 'explain',
    label: 'Giải thích',
    prompt: 'Giải thích đoạn này một cách dễ hiểu kèm ví dụ minh họa.',
  },
  {
    id: 'summarize',
    label: 'Tóm tắt',
    prompt: 'Tóm tắt các ý chính quan trọng nhất trong đoạn này.',
  },
  {
    id: 'fix_spelling',
    label: 'Sửa chính tả',
    prompt:
      'Kiểm tra, sửa lỗi chính tả và gợi ý cách diễn đạt tự nhiên hơn cho đoạn này.',
  },
  {
    id: 'translate',
    label: 'Dịch',
    prompt:
      'Dịch đoạn này sang Tiếng Việt (hoặc sang Tiếng Anh nếu đoạn gốc đang viết bằng Tiếng Việt).',
  },
  {
    id: 'quiz_me',
    label: 'Câu hỏi ôn tập',
    prompt:
      'Tạo 3 câu hỏi tự kiểm tra ngắn kèm đáp án dựa trên đoạn kiến thức này.',
  },
];

const DEFAULT_MAX_SELECTION_CHARS = 2500;

/**
 * Chuẩn hóa đoạn văn bản được bôi đen từ Tiptap trước khi đóng gói vào prompt hoặc hiển thị preview.
 */
export function normalizeSelectionText(
  rawText: string,
  maxChars = DEFAULT_MAX_SELECTION_CHARS,
): string {
  const normalized = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized || maxChars <= 0) {
    return '';
  }

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

export interface FormatSelectionAskPromptInput {
  selectedText: string;
  prompt: string;
  fileName?: string | null;
}

/**
 * Đóng gói đoạn văn bản đang bôi đen + câu lệnh người dùng thành tin nhắn Markdown sạch gửi lên RightSidebar.
 */
export function formatSelectionAskPrompt(
  input: FormatSelectionAskPromptInput,
): string {
  const cleanSelection = normalizeSelectionText(input.selectedText);
  const cleanPrompt = input.prompt.trim();

  if (!cleanSelection) {
    return cleanPrompt;
  }

  const safeFileName = input.fileName?.trim();
  const headerLine = safeFileName
    ? `> **Trích đoạn từ \`${safeFileName}\`:**`
    : '> **Trích đoạn đang chọn:**';

  const quotedBody = cleanSelection
    .split('\n')
    .map((line) => (line.trim().length > 0 ? `> ${line}` : '>'))
    .join('\n');

  if (!cleanPrompt) {
    return `${headerLine}\n${quotedBody}`;
  }

  return `${headerLine}\n${quotedBody}\n\n${cleanPrompt}`;
}
