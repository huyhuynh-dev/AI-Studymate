import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUBBLE_AI_QUICK_PROMPTS,
  formatSelectionAskPrompt,
  normalizeSelectionText,
} from '../ask-ai-prompt.helper.ts';

describe('ask-ai-prompt.helper', () => {
  it('chuẩn hóa văn bản bôi đen và cắt gọn an toàn khi vượt ngưỡng ký tự', () => {
    const raw = '  Dòng 1\r\n\r\n\r\n\r\nDòng 2   ';
    assert.equal(normalizeSelectionText(raw), 'Dòng 1\n\nDòng 2');

    const longText = 'A'.repeat(120);
    const truncated = normalizeSelectionText(longText, 30);
    assert.equal(truncated.length, 30);
    assert.ok(truncated.endsWith('…'));
  });

  it('đóng gói đoạn bôi đen nhiều dòng + prompt thành Markdown blockquote kèm tên tệp', () => {
    const result = formatSelectionAskPrompt({
      selectedText: 'Khái niệm Deadlock\n\nXảy ra khi có 4 điều kiện.',
      prompt: 'Tóm tắt lại thành 2 gạch đầu dòng',
      fileName: 'he-dieu-hanh.txt',
    });

    assert.equal(
      result,
      [
        '> **Trích đoạn từ `he-dieu-hanh.txt`:**',
        '> Khái niệm Deadlock',
        '>',
        '> Xảy ra khi có 4 điều kiện.',
        '',
        'Tóm tắt lại thành 2 gạch đầu dòng',
      ].join('\n'),
    );

    const noFileResult = formatSelectionAskPrompt({
      selectedText: 'Một câu ngắn',
      prompt: 'Dịch sang Tiếng Anh',
    });
    assert.ok(noFileResult.startsWith('> **Trích đoạn đang chọn:**\n> Một câu ngắn'));

    const pdfPageResult = formatSelectionAskPrompt({
      selectedText: 'Định lý Bayes liên hệ xác suất có điều kiện.',
      prompt: 'Giải thích công thức này',
      fileName: 'probability.pdf',
      pageNo: 4,
    });
    assert.equal(
      pdfPageResult,
      [
        '> **Trích đoạn từ `probability.pdf` (Trang 4):**',
        '> Định lý Bayes liên hệ xác suất có điều kiện.',
        '',
        'Giải thích công thức này',
      ].join('\n'),
    );
  });

  it('cung cấp đầy đủ danh sách gợi ý nhanh hợp lệ', () => {
    assert.ok(BUBBLE_AI_QUICK_PROMPTS.length >= 4);
    const ids = BUBBLE_AI_QUICK_PROMPTS.map((q) => q.id);
    assert.deepEqual(ids, ['explain', 'summarize', 'fix_spelling', 'translate', 'quiz_me']);
    for (const item of BUBBLE_AI_QUICK_PROMPTS) {
      assert.ok(item.label.trim().length > 0);
      assert.ok(item.prompt.trim().length > 0);
    }
  });
});
