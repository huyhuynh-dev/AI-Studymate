import { describe, it, expect, beforeAll, vi } from 'vitest';

type PdfMod = {
  unwrapDoclingBBox: (raw: unknown) => Record<string, unknown> | null;
  toEmbedPdfRect: (raw: unknown, pageHeight: number) => { x: number; y: number; width: number; height: number } | null;
  calcBoxPixels: (
    raw: unknown,
    pw: number,
    ph: number,
    rw: number,
    rh: number,
  ) => { left: number; top: number; width: number; height: number } | null;
};

type CitationMod = {
  sanitizeStreamingCitations: (text: string, isStreaming: boolean) => string;
  parseAndFormatCitations: (
    raw: string,
    map: Map<string, CitationItem>,
    isStreaming?: boolean,
  ) => {
    formattedContent: string;
    citedList: Array<{ displayNumber: number; citationId: string }>;
  };
  extractCitationsMap: (message: unknown) => Map<string, CitationItem>;
  formatCitationRankingMeta: (
    item?: DocumentCitationItem,
  ) => { label: string; detail: string; isReranked: boolean } | null;
};

let unwrapDoclingBBox: PdfMod['unwrapDoclingBBox'];
let toEmbedPdfRect: PdfMod['toEmbedPdfRect'];
let calcBoxPixels: PdfMod['calcBoxPixels'];
let sanitizeStreamingCitations: CitationMod['sanitizeStreamingCitations'];
let parseAndFormatCitations: CitationMod['parseAndFormatCitations'];
let extractCitationsMap: CitationMod['extractCitationsMap'];
let formatCitationRankingMeta: CitationMod['formatCitationRankingMeta'];

type DocumentCitationItem = {
  sourceType: 'document';
  citationId: string;
  documentId: string;
  fileName: string;
  pageNumbers: number[];
  headings: string[];
  rrfScore?: number;
  rerankScore?: number | null;
  rrfRank?: number | null;
  vectorRank?: number | null;
  keywordRank?: number | null;
};

type WebCitationItem = {
  sourceType: 'web';
  citationId: string;
  title: string;
  url: string;
  domain: string;
};

type CitationItem = DocumentCitationItem | WebCitationItem;

beforeAll(async () => {
  const pdfMod = await vi.importActual<PdfMod>('../../../../client/src/lib/pdf-coordinates.ts');
  unwrapDoclingBBox = pdfMod.unwrapDoclingBBox;
  toEmbedPdfRect = pdfMod.toEmbedPdfRect;
  calcBoxPixels = pdfMod.calcBoxPixels;

  const citMod = await vi.importActual<CitationMod>('../../../../client/src/lib/citation-parser.ts');
  sanitizeStreamingCitations = citMod.sanitizeStreamingCitations;
  parseAndFormatCitations = citMod.parseAndFormatCitations;
  extractCitationsMap = citMod.extractCitationsMap;
  formatCitationRankingMeta = citMod.formatCitationRankingMeta;
});

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
      expect(
        result.citedList.map((c: { displayNumber: number; citationId: string }) => ({
          num: c.displayNumber,
          id: c.citationId,
        })),
      ).toEqual([
        { num: 1, id: 'c4' },
        { num: 2, id: 'c13' },
        { num: 3, id: 'w1' },
        { num: 4, id: 'c1' },
        { num: 5, id: 'w2' },
      ]);
    });

    it('nên hiển thị nhãn formatCitationRankingMeta đúng chuẩn cho Rerank vs Fallback RRF và trích xuất từ extractCitationsMap', () => {
      const rerankedDoc: DocumentCitationItem = {
        sourceType: 'document',
        citationId: 'c1',
        documentId: 'doc-1',
        fileName: 'OS.pdf',
        pageNumbers: [12],
        headings: ['Deadlock'],
        rerankScore: -0.8412,
        rrfScore: 0.025,
        rrfRank: 4,
        vectorRank: 2,
        keywordRank: 1,
      };
      const meta = formatCitationRankingMeta(rerankedDoc);
      expect(meta).toEqual({
        label: 'Rerank -0.84 · RRF #4',
        detail: 'Điểm Rerank: -0.8412 | Vector #2 · Keyword #1 · RRF Score 0.0250',
        isReranked: true,
      });

      const rrfOnlyDoc: DocumentCitationItem = {
        sourceType: 'document',
        citationId: 'c2',
        documentId: 'doc-1',
        fileName: 'OS.pdf',
        pageNumbers: [5],
        headings: [],
        rerankScore: null,
        rrfScore: 0.032,
        vectorRank: 1,
        keywordRank: null,
      };
      expect(formatCitationRankingMeta(rrfOnlyDoc)).toEqual({
        label: 'RRF 0.0320',
        detail: 'Vector #1 · Keyword — · RRF Score 0.0320',
        isReranked: false,
      });

      expect(formatCitationRankingMeta(undefined)).toBeNull();

      const extracted = extractCitationsMap({
        id: 'msg-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-searchDocumentChunks',
            output: {
              chunks: [
                {
                  citationId: 'c1',
                  id: 'chk-1',
                  documentId: 'doc-1',
                  fileName: 'OS.pdf',
                  pageNumbers: [12],
                  headings: ['Deadlock'],
                  content: 'Banker algorithm',
                  rrfScore: 0.025,
                  rerankScore: -0.8412,
                  rrfRank: 4,
                  vectorRank: 2,
                  keywordRank: 1,
                },
              ],
            },
          },
        ],
      } as never);
      expect(extracted.get('c1')).toMatchObject({
        rerankScore: -0.8412,
        rrfScore: 0.025,
        rrfRank: 4,
        vectorRank: 2,
        keywordRank: 1,
      });
    });
  });
});
