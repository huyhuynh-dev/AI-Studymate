/**
 * Tiện ích phân tích, chuẩn hóa và đánh số trích dẫn (Hybrid Citation Parser)
 * 
 * - Ánh xạ các mã nội bộ (c1, c2..., w1, w2...) sang số thứ tự tăng dần [1], [2], [3]...
 *   theo thứ tự xuất hiện lần đầu tiên trong câu trả lời của AI.
 * - Tái sử dụng số thứ tự nếu cùng 1 mã cX/wX xuất hiện lại ở các câu tiếp theo.
 * - Sử dụng cú pháp hash chuẩn markdown: [1](#citation-c4) để react-markdown không lọc mất.
 * - Xử lý các cụm trích dẫn: [c1][c2], [c1, c2], [c1, w1], [w1, w2]...
 * - Cắt tỉa mượt mà các thẻ đang gõ dở ở cuối chuỗi khi đang stream ([c, [w1, ).
 */

import type { ChatMessage } from '@/components/layout/RightSidebar/types';

export type CitationSourceType = 'document' | 'web';

export interface RetrievedChunkAsset {
  id: string;
  assetType: string;
  storageKey: string;
  caption?: string | null;
  pageNo?: number | null;
}

export interface DocumentCitationItem {
  sourceType: 'document';
  citationId: string; // "c1", "c2", ...
  chunkId?: string;
  documentId: string;
  fileName: string;
  pageNumbers: number[];
  headings: string[];
  rawContent?: string | null;
  content?: string;
  previewSnippet?: string;
  bboxes?: unknown;
  assets?: RetrievedChunkAsset[] | unknown[];
}

export interface WebCitationItem {
  sourceType: 'web';
  citationId: string; // "w1", "w2", ...
  title: string;
  url: string;
  domain: string;
  favicon?: string;
  publishedDate?: string;
  previewSnippet?: string;
}

export type CitationItem = DocumentCitationItem | WebCitationItem;

export interface CitationBadgeMeta {
  displayNumber: number; // 1, 2, 3...
  citationId: string; // "c1", "w2"...
  sourceType: CitationSourceType;
  item?: CitationItem;
}

export interface ParsedCitationsResult {
  formattedContent: string;
  citedList: CitationBadgeMeta[];
  citationMap: Map<string, CitationItem>;
  metaMap: Map<string, CitationBadgeMeta>;
}

/**
 * Trích xuất bản đồ tra cứu CitationItem từ ChatMessage (hỗ trợ cả metadata và parts)
 */
export function extractCitationsMap(
  message: ChatMessage,
): Map<string, CitationItem> {
  const map = new Map<string, CitationItem>();

  // 1. Nguồn ưu tiên cao nhất: message.metadata.citations (Lưu vết bền vững trong CSDL)
  if (Array.isArray(message.metadata?.citations)) {
    for (const item of message.metadata.citations) {
      if (item && item.citationId) {
        map.set(item.citationId, item);
      }
    }
  }

  // 2. Nguồn bổ trợ khi đang streaming: quét qua message.parts
  if (Array.isArray(message.parts)) {
    for (const part of message.parts) {
      // 2a. searchDocumentChunks & getDocumentSectionOrPages
      const chunks =
        part.output?.chunks ||
        (Array.isArray(part.output?.sources) ? part.output.sources : null);
      if (Array.isArray(chunks)) {
        for (const chunk of chunks) {
          if (chunk && chunk.citationId && !map.has(chunk.citationId)) {
            map.set(chunk.citationId, {
              sourceType: 'document',
              citationId: chunk.citationId,
              chunkId: chunk.chunkId || chunk.id,
              documentId: chunk.documentId,
              fileName: chunk.fileName || 'Tài liệu',
              pageNumbers: Array.isArray(chunk.pageNumbers) ? chunk.pageNumbers : [],
              headings: Array.isArray(chunk.headings) ? chunk.headings : [],
              rawContent: chunk.rawContent || chunk.content,
              previewSnippet: chunk.previewSnippet || chunk.content?.slice(0, 300),
              bboxes: chunk.bboxes,
              assets: chunk.assets,
            });
          }
        }
      }

      // 2b. searchInternet & extractWebPage
      const webResults =
        part.output?.results ||
        (part.type === 'tool-searchInternet' && Array.isArray(part.output?.items)
          ? part.output.items
          : null);
      if (Array.isArray(webResults)) {
        for (const res of webResults) {
          if (res && res.citationId && !map.has(res.citationId)) {
            map.set(res.citationId, {
              sourceType: 'web',
              citationId: res.citationId,
              title: res.title || res.domain || 'Nguồn Web',
              url: res.url || '',
              domain: res.domain || '',
              favicon: res.favicon,
              publishedDate: res.publishedDate,
              previewSnippet: res.previewSnippet || res.snippet || res.extractedContent?.slice(0, 300),
            });
          }
        }
      }
    }
  }

  return map;
}

/**
 * Ẩn mượt mà các thẻ trích dẫn đang gõ dở ở cuối chuỗi khi đang stream
 * Ví dụ: "...nội dung [c", "...đáp án [w1, " sẽ bị cắt phần đuôi dở dang
 */
export function sanitizeStreamingCitations(
  text: string,
  isStreaming: boolean,
): string {
  if (!isStreaming || !text) return text;
  // Bắt đuôi mở ngoặc vuông chưa đóng hoặc đang gõ dở mã cX/wX
  return text.replace(/\[\s*(?:(?:c|w)\d*\s*(?:,\s*)?)*$/i, '');
}

/**
 * Regex bắt mọi biến thể cụm trích dẫn:
 * - [c1]
 * - [w2]
 * - [c1][c2]
 * - [c1, c2]
 * - [c1, w2]
 * - [c1,c2]
 */
const CITATION_GROUP_REGEX = /\[\s*([cw]\d+(?:\s*,\s*[cw]\d+)*)\s*\]/gi;

/**
 * Xử lý nội dung văn bản:
 * 1. Thu dọn thẻ đang gõ dở khi streaming.
 * 2. Tìm tất cả các mã [cX], [wX], ánh xạ thành số thứ tự [1], [2], [3]... theo thứ tự xuất hiện.
 * 3. Chuyển đổi thành cú pháp liên kết hash: [1](#citation-c1).
 * 4. Trả về danh sách trích dẫn đã được sử dụng phục vụ CollapsibleSourceBar.
 */
export function parseAndFormatCitations(
  rawContent: string,
  citationMap: Map<string, CitationItem>,
  isStreaming = false,
): ParsedCitationsResult {
  const sanitized = sanitizeStreamingCitations(rawContent || '', isStreaming);

  // Tách các cụm trích dẫn dính liền nhau [c1][c2] thành [c1] [c2] để tạo khoảng cách giữa các badge
  const normalizedText = sanitized.replace(
    /\]\s*\[(?=[cw]\d)/gi,
    '] [',
  );

  const allocatedNumbers = new Map<string, number>();
  const metaMap = new Map<string, CitationBadgeMeta>();
  const citedList: CitationBadgeMeta[] = [];
  let nextDisplayIndex = 1;

  // Quét và thay thế từng cụm trích dẫn
  const formattedContent = normalizedText.replace(
    CITATION_GROUP_REGEX,
    (_fullMatch, innerGroup: string) => {
      // Tách các mã riêng lẻ trong cụm (ví dụ "c1, c2" -> ["c1", "c2"])
      const ids = innerGroup
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[cw]\d+$/.test(s));

      if (ids.length === 0) return _fullMatch;

      const badgesMarkdown = ids.map((id) => {
        let displayNum = allocatedNumbers.get(id);
        if (!displayNum) {
          displayNum = nextDisplayIndex++;
          allocatedNumbers.set(id, displayNum);

          const item = citationMap.get(id);
          const sourceType: CitationSourceType = id.startsWith('w')
            ? 'web'
            : 'document';

          const meta: CitationBadgeMeta = {
            displayNumber: displayNum,
            citationId: id,
            sourceType: item?.sourceType || sourceType,
            item,
          };

          metaMap.set(id, meta);
          citedList.push(meta);
        }

        // Tạo markdown link có hash để react-markdown không chặn
        return `[${displayNum}](#citation-${id})`;
      });

      // Đặt các badge nằm cạnh nhau với khoảng cách nhỏ
      return badgesMarkdown.join(' ');
    },
  );

  return {
    formattedContent,
    citedList,
    citationMap,
    metaMap,
  };
}
