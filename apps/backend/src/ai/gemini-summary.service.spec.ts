import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiSummaryService } from './gemini-summary.service.js';

describe('GeminiSummaryService', () => {
  let service: GeminiSummaryService;
  let configService: any;

  beforeEach(() => {
    configService = {
      get: vi.fn().mockReturnValue('test-fake-gemini-api-key'),
    };
    service = new GeminiSummaryService(configService);
  });

  it('nên khởi tạo thành công với model gemini-3.6-flash', () => {
    expect(service).toBeDefined();
  });

  it('nên parse JSON hợp lệ từ AI và chuẩn hóa blocks có id duy nhất', () => {
    const rawAiResponse = JSON.stringify({
      title: 'Tóm tắt ôn thi Cấu trúc Dữ liệu',
      blocks: [
        {
          type: 'heading',
          props: { level: 1 },
          content: [{ type: 'text', text: 'Chương 1: Mở đầu' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Nội dung đoạn văn', styles: { bold: true } }],
        },
        {
          type: 'bulletListItem',
          content: [{ type: 'text', text: 'Ý quan trọng 1' }],
        },
      ],
    });

    const parsed = (service as any).parseSummaryJson(rawAiResponse);
    expect(parsed.title).toBe('Tóm tắt ôn thi Cấu trúc Dữ liệu');
    expect(parsed.blocks).toHaveLength(3);
    expect(parsed.blocks[0].id).toBeDefined();
    expect(parsed.blocks[0].type).toBe('heading');
    expect(parsed.blocks[1].type).toBe('paragraph');
    expect(parsed.blocks[2].type).toBe('bulletListItem');
  });

  it('nên fallback sang Markdown -> Blocks khi AI trả về văn bản không phải JSON', () => {
    const markdown = `# Tiêu đề chính
## 1. Khái niệm cốt lõi
Đoạn văn giải thích khái niệm.
- Ý chính thứ nhất
- Ý chính thứ hai
1. Bước một`;

    const parsed = (service as any).parseSummaryJson(markdown);
    expect(parsed.title).toBe('Tiêu đề chính');
    expect(parsed.blocks.length).toBeGreaterThanOrEqual(4);
    expect(parsed.blocks.some((b: any) => b.type === 'bulletListItem')).toBe(true);
    expect(parsed.blocks.some((b: any) => b.type === 'numberedListItem')).toBe(true);
  });
});
