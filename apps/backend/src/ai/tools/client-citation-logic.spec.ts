import { describe, it, expect } from 'vitest';
import {
  unwrapDoclingBBox,
  toEmbedPdfRect,
  calcBoxPixels,
} from '../../../../client/src/lib/pdf-coordinates';
import {
  sanitizeStreamingCitations,
  parseAndFormatCitations,
  CitationItem,
} from '../../../../client/src/lib/citation-parser';

describe('Phase 2 Client Logic Verification', () => {
  describe('pdf-coordinates', () => {
    it('nên unwrap an toàn cả dạng Flat và Nested bbox', () => {
      const flat = { page_no: 3, l: 100, t: 700, r: 400, b: 650, coord_origin: 'BOTTOMLEFT' };
      const nested = {
        page_no: 3,
        label: 'text',
        bbox: { l: 100, t: 700, r: 400, b: 650, coord_origin: 'BOTTOMLEFT' },
      };

      const unwrapFlat = unwrapDoclingBBox(flat);
      const unwrapNested = unwrapDoclingBBox(nested);

      expect(unwrapFlat).toEqual({
        page_no: 3,
        l: 100,
        t: 700,
        r: 400,
        b: 650,
        coord_origin: 'BOTTOMLEFT',
      });
      expect(unwrapNested).toEqual({
        page_no: 3,
        l: 100,
        t: 700,
        r: 400,
        b: 650,
        coord_origin: 'BOTTOMLEFT',
      });
    });

    it('nên trả về null nếu dữ liệu bbox bị hỏng hoặc NaN', () => {
      expect(unwrapDoclingBBox(null)).toBeNull();
      expect(unwrapDoclingBBox({ l: 'invalid' })).toBeNull();
    });

    it('nên quy đổi chuẩn xác hệ tọa độ BOTTOMLEFT sang EmbedPDF TOPLEFT', () => {
      const nested = {
        bbox: { l: 100, t: 700, r: 400, b: 650, coord_origin: 'BOTTOMLEFT' },
      };
      // pageHeight = 792 pt
      // top từ đáy = 700 -> cách đỉnh trang = 792 - 700 = 92 pt
      // width = 300, height = 50
      const rect = toEmbedPdfRect(nested, 792);
      expect(rect).toEqual({
        x: 100,
        y: 92,
        width: 300,
        height: 50,
      });
    });

    it('nên giữ nguyên tọa độ nếu gốc đã là TOPLEFT', () => {
      const topleft = {
        l: 50,
        t: 120,
        r: 250,
        b: 180,
        coord_origin: 'TOPLEFT',
      };
      const rect = toEmbedPdfRect(topleft, 792);
      expect(rect).toEqual({
        x: 50,
        y: 120,
        width: 200,
        height: 60,
      });
    });

    it('nên tính toán chính xác tọa độ Pixels theo tỷ lệ render trang', () => {
      const nested = {
        bbox: { l: 100, t: 700, r: 400, b: 650, coord_origin: 'BOTTOMLEFT' },
      };
      // Point size: 612 x 792. Rendered pixel: 1224 x 1584 (tương ứng zoom 2x)
      const pixels = calcBoxPixels(nested, 612, 792, 1224, 1584);
      expect(pixels).toEqual({
        left: 200,
        top: 184,
        width: 600,
        height: 100,
      });
    });
  });

  describe('citation-parser', () => {
    it('nên cắt tỉa mượt mà các thẻ trích dẫn đang gõ dở ở cuối chuỗi khi đang stream', () => {
      expect(sanitizeStreamingCitations('Khái niệm [c', true)).toBe('Khái niệm ');
      expect(sanitizeStreamingCitations('Tra cứu [w1, ', true)).toBe('Tra cứu ');
      expect(sanitizeStreamingCitations('Đoạn văn [', true)).toBe('Đoạn văn ');
      // Không cắt nếu đã đóng ngoặc hoàn chỉnh
      expect(sanitizeStreamingCitations('Đoạn văn [c1]', true)).toBe('Đoạn văn [c1]');
      // Không cắt nếu không ở chế độ stream
      expect(sanitizeStreamingCitations('Khái niệm [c', false)).toBe('Khái niệm [c');
    });

    it('nên ánh xạ tuần tự [1], [2] và tái sử dụng mã ID khi xuất hiện lại', () => {
      const text =
        'Theo tài liệu, Binary Search đạt O(log N) [c4, c13]. Đối với 100k phần tử chỉ tốn 17 phép toán [c13]. Nguồn web [w1] và tài liệu [c4] xác nhận [c1][w2].';

      const citationMap = new Map<string, CitationItem>([
        [
          'c4',
          {
            sourceType: 'document',
            citationId: 'c4',
            documentId: 'doc-1',
            fileName: 'algorithms.pdf',
            pageNumbers: [4],
            headings: ['Chương 2'],
          },
        ],
        [
          'c13',
          {
            sourceType: 'document',
            citationId: 'c13',
            documentId: 'doc-1',
            fileName: 'algorithms.pdf',
            pageNumbers: [10],
            headings: [],
          },
        ],
        [
          'w1',
          {
            sourceType: 'web',
            citationId: 'w1',
            title: 'GeeksforGeeks',
            url: 'https://geeksforgeeks.org',
            domain: 'geeksforgeeks.org',
          },
        ],
        [
          'w2',
          {
            sourceType: 'web',
            citationId: 'w2',
            title: 'Wikipedia',
            url: 'https://wikipedia.org',
            domain: 'wikipedia.org',
          },
        ],
      ]);

      const result = parseAndFormatCitations(text, citationMap);

      // Thứ tự gặp lần đầu:
      // c4 -> 1
      // c13 -> 2
      // c13 gặp lại -> 2
      // w1 -> 3
      // c4 gặp lại -> 1
      // c1 -> 4
      // w2 -> 5
      expect(result.formattedContent).toContain('[1](#citation-c4) [2](#citation-c13)');
      expect(result.formattedContent).toContain('17 phép toán [2](#citation-c13)');
      expect(result.formattedContent).toContain('Nguồn web [3](#citation-w1)');
      expect(result.formattedContent).toContain('tài liệu [1](#citation-c4)');
      expect(result.formattedContent).toContain('[4](#citation-c1) [5](#citation-w2)');

      // Kiểm tra danh sách trích dẫn citedList phục vụ CollapsibleSourceBar
      expect(result.citedList.map((c) => ({ num: c.displayNumber, id: c.citationId }))).toEqual([
        { num: 1, id: 'c4' },
        { num: 2, id: 'c13' },
        { num: 3, id: 'w1' },
        { num: 4, id: 'c1' },
        { num: 5, id: 'w2' },
      ]);
    });
  });
});
