import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buildDoclingConvertPayload,
  buildDoclingHybridChunkPayload,
  DEFAULT_CHUNK_MAX_TOKENS,
  DEFAULT_VIETNAMESE_TOKENIZER,
  type DoclingChunkSourceMode,
  type DoclingVlmApiConfig,
} from '../payloads/index.js';

export type DoclingChunkType =
  | 'text'
  | 'table'
  | 'code'
  | 'formula'
  | 'image_desc'
  | 'mixed';

export interface DoclingChunkBboxItem {
  self_ref: string | null;
  label: string | null;
  page_no: number | null;
  bbox: Record<string, unknown> | null;
}

export interface DoclingChunkResult {
  index: number;
  pageNumbers: number[];
  content: string;
  rawContent?: string;
  tokenCount?: number;
  headings?: string[];
  bboxes?: DoclingChunkBboxItem[];
  chunkType?: DoclingChunkType;
  hasImage?: boolean;
  hasTable?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ExtractedDoclingPicture {
  index: number;
  selfRef: string;
  assetType: string;
  pageNo: number | null;
  bbox: Record<string, unknown> | null;
  caption: string | null;
  vlmDescription: string | null;
  mimeType: string;
  buffer: Buffer;
}

export interface DoclingTocItem {
  text: string;
  level: number;
  page_no: number | null;
}

export interface DoclingDocumentMetadata {
  toc: DoclingTocItem[];
  processing_time: number;
  total_tables: number;
  total_pictures: number;
  [key: string]: unknown;
}

export interface DoclingConversionResult {
  mdContent: string;
  sanitizedJsonContent: Record<string, unknown> | null;
  pageCount: number;
  docMetadata: DoclingDocumentMetadata;
  extractedPictures: ExtractedDoclingPicture[];
}

export class DoclingTaskError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DoclingTaskError';
  }
}

const DATA_URI_IMAGE_REGEX =
  /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/;
const MARKDOWN_BASE64_IMAGE_REGEX =
  /!\[([^\]]*)\]\(data:image\/[a-zA-Z0-9.+-]+;base64,[^)]+\)/g;

export const TRANSPARENT_1X1_PNG_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

@Injectable()
export class DoclingService {
  private readonly logger = new Logger(DoclingService.name);
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly pollWaitSeconds = 2;
  private readonly pollIntervalMs = 1000;
  private readonly tokenizer: string;
  private readonly maxTokens: number;
  private readonly vlmApiConfig: DoclingVlmApiConfig | null;
  private readonly doChartExtraction: boolean;

  constructor(private readonly configService: ConfigService) {
    const rawUrl =
      this.configService.get<string>('DOCLING_SERVER_URL') ||
      'http://localhost:5001';
    this.baseUrl = rawUrl.replace(/\/+$/, '');
    this.apiKey =
      this.configService.get<string>('DOCLING_SERVE_API_KEY')?.trim() ||
      undefined;

    const timeoutSec =
      Number(this.configService.get<string>('DOCLING_TIMEOUT_SECONDS')) || 180;
    this.timeoutMs = timeoutSec * 1000;

    this.tokenizer =
      this.configService.get<string>('DOCLING_TOKENIZER')?.trim() ||
      DEFAULT_VIETNAMESE_TOKENIZER;
    this.maxTokens =
      Number(this.configService.get<string>('DOCLING_MAX_TOKENS')) ||
      DEFAULT_CHUNK_MAX_TOKENS;

    const vlmUrl = this.configService.get<string>('DOCLING_VLM_API_URL')?.trim();
    const vlmKey = this.configService.get<string>('DOCLING_VLM_API_KEY')?.trim();
    const vlmModel =
      this.configService.get<string>('DOCLING_VLM_MODEL')?.trim() ||
      'gpt-4.1-mini';
    const vlmTimeoutSec =
      Number(this.configService.get<string>('DOCLING_VLM_TIMEOUT_SEC')) || 60;

    this.vlmApiConfig =
      vlmUrl && vlmKey
        ? {
            url: vlmUrl,
            apiKey: vlmKey,
            model: vlmModel,
            timeoutSec: vlmTimeoutSec,
          }
        : null;

    this.doChartExtraction =
      this.configService.get<string>('DOCLING_DO_CHART_EXTRACTION') === 'true';

    this.logger.log(
      `DoclingService khởi tạo thành công [URL: ${this.baseUrl}, Timeout: ${timeoutSec}s, Tokenizer: ${this.tokenizer}, VLM API: ${this.vlmApiConfig ? 'Enabled' : 'Disabled'}]`,
    );
  }

  private buildHeaders(includeJsonContentType = false): Record<string, string> {
    const headers: Record<string, string> = {};
    if (includeJsonContentType) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.apiKey) {
      headers['X-Api-Key'] = this.apiKey;
    }
    return headers;
  }

  /**
   * Kiểm tra trạng thái hoạt động của Docling Server
   */
  async isHealthy(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${this.baseUrl}/health`, {
        headers: this.buildHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) return false;
      const data = (await res.json()) as { status?: string };
      return data?.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Chuyển đổi tài liệu (PDF, DOCX, PPTX, XLSX, CSV...) sang Enriched Markdown + DoclingDocument JSON.
   * Đồng thời bóc tách các hình ảnh nhúng (base64), trích xuất mục lục (TOC), số trang,
   * và làm sạch chuỗi Base64 nặng trong JSON để sẵn sàng lưu R2 & chuyển tiếp sang HybridChunker.
   */
  async convertDocument(
    fileBuffer: Buffer,
    fileName: string,
  ): Promise<DoclingConversionResult> {
    if (!fileBuffer || fileBuffer.length === 0) {
      return {
        mdContent: '',
        sanitizedJsonContent: null,
        pageCount: 1,
        docMetadata: {
          toc: [],
          processing_time: 0,
          total_tables: 0,
          total_pictures: 0,
        },
        extractedPictures: [],
      };
    }

    const normalizedName = this.normalizeConvertFileName(fileName);
    const base64String = fileBuffer.toString('base64');
    const reqBody = buildDoclingConvertPayload({
      fileName: normalizedName,
      base64String,
      vlmApi: this.vlmApiConfig,
      doChartExtraction: this.doChartExtraction,
    });

    this.logger.debug(
      `Gửi request convert async tới Docling Server cho [${normalizedName}]`,
    );
    const submitRes = await fetch(`${this.baseUrl}/v1/convert/source/async`, {
      method: 'POST',
      headers: this.buildHeaders(true),
      body: JSON.stringify(reqBody),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text().catch(() => '');
      throw new Error(
        `Docling convert request thất bại (HTTP ${submitRes.status}): ${errText}`,
      );
    }

    const submitData = (await submitRes.json()) as { task_id?: string };
    const taskId = submitData.task_id;
    if (!taskId) {
      throw new Error(
        'Docling không trả về task_id hợp lệ cho tác vụ convert',
      );
    }

    await this.pollTaskStatus(taskId, `convert [${normalizedName}]`);

    const resultRes = await fetch(`${this.baseUrl}/v1/result/${taskId}`, {
      headers: this.buildHeaders(),
    });
    if (!resultRes.ok) {
      const errText = await resultRes.text().catch(() => '');
      throw new Error(
        `Docling get convert result thất bại (HTTP ${resultRes.status}): ${errText}`,
      );
    }

    const resultData = (await resultRes.json()) as {
      document?: {
        md_content?: string;
        json_content?: Record<string, unknown>;
      };
      processing_time?: number;
    };

    const rawMd =
      typeof resultData.document?.md_content === 'string'
        ? resultData.document.md_content
        : '';
    const rawJson =
      resultData.document?.json_content &&
      typeof resultData.document.json_content === 'object'
        ? resultData.document.json_content
        : null;

    const processingTime =
      typeof resultData.processing_time === 'number'
        ? Number(resultData.processing_time.toFixed(2))
        : 0;

    return this.parseAndSanitizeConversionOutput(rawMd, rawJson, processingTime);
  }

  /**
   * Giữ tương thích ngược cho các lời gọi chỉ cần chuỗi Markdown
   */
  async convertDocumentToMarkdown(
    fileBuffer: Buffer,
    fileName: string,
  ): Promise<string> {
    const result = await this.convertDocument(fileBuffer, fileName);
    return result.mdContent;
  }

  /**
   * Cách 3A: Phân mảnh tài liệu bằng cách truyền trực tiếp cây DOM json_docling
   * đã được Convert ở Bước 1 sang API HybridChunker.
   * Giúp Docling Server KHÔNG phải chạy lại OCR, TableFormer hay gọi lại VLM API lần 2.
   */
  async chunkFromDoclingJson(
    sanitizedJsonContent: Record<string, unknown>,
    originalFileName: string,
  ): Promise<DoclingChunkResult[]> {
    const jsonString = JSON.stringify(sanitizedJsonContent);
    const base64String = Buffer.from(jsonString, 'utf-8').toString('base64');
    const baseName = originalFileName.replace(/\.[^.]+$/, '') || 'document';
    const jsonFileName = `${baseName}.json`;

    return this.executeHybridChunk({
      base64String,
      fileName: jsonFileName,
      mode: 'json_docling',
      actionDesc: `chunk json_docling [${jsonFileName}]`,
    });
  }

  /**
   * Phân mảnh văn bản Markdown (.md hoặc .txt) qua HybridChunker của Docling Server
   */
  async chunkMarkdownHybrid(
    markdown: string,
    fileName = 'document.md',
  ): Promise<DoclingChunkResult[]> {
    if (!markdown || markdown.trim().length === 0) {
      return [];
    }

    const baseName = fileName.replace(/\.[^.]+$/, '') || 'document';
    const safeFileName = `${baseName}.md`;
    const base64String = Buffer.from(markdown, 'utf-8').toString('base64');

    return this.executeHybridChunk({
      base64String,
      fileName: safeFileName,
      mode: 'markdown',
      actionDesc: `chunk markdown [${safeFileName}]`,
    });
  }

  /**
   * Phân mảnh trực tiếp từ Buffer tệp gốc (sử dụng khi không qua bước Convert json_docling)
   */
  async chunkDocumentHybrid(
    fileBuffer: Buffer,
    fileName: string,
  ): Promise<DoclingChunkResult[]> {
    if (!fileBuffer || fileBuffer.length === 0) {
      return [];
    }

    const normalizedName = this.normalizeConvertFileName(fileName);
    const base64String = fileBuffer.toString('base64');
    return this.executeHybridChunk({
      base64String,
      fileName: normalizedName,
      mode: 'file',
      actionDesc: `chunk file [${normalizedName}]`,
    });
  }

  private normalizeConvertFileName(fileName: string): string {
    const trimmed = fileName?.trim() || 'document.pdf';
    if (trimmed.toLowerCase().endsWith('.txt')) {
      return `${trimmed.slice(0, -4)}.md`;
    }
    return trimmed;
  }

  private parseAndSanitizeConversionOutput(
    rawMd: string,
    rawJson: Record<string, unknown> | null,
    processingTime: number,
  ): DoclingConversionResult {
    let pictureCounter = 0;
    const cleanedMd = rawMd
      .replace(MARKDOWN_BASE64_IMAGE_REGEX, (_match, altText: string) => {
        const ref = `#/pictures/${pictureCounter++}`;
        const label = altText?.trim() || 'Image';
        return `![${label}](${ref})`;
      })
      .trim();

    if (!rawJson) {
      return {
        mdContent: cleanedMd,
        sanitizedJsonContent: null,
        pageCount: 1,
        docMetadata: {
          toc: this.extractTocFromMarkdown(cleanedMd),
          processing_time: processingTime,
          total_tables: 0,
          total_pictures: 0,
        },
        extractedPictures: [],
      };
    }

    const pagesObj =
      rawJson.pages && typeof rawJson.pages === 'object'
        ? (rawJson.pages as Record<string, Record<string, unknown>>)
        : {};
    const pageKeys = Object.keys(pagesObj);
    const pageCount = Math.max(1, pageKeys.length);

    // Xóa chuỗi base64 ảnh chụp toàn trang trong pages.*.image.uri (nếu có)
    for (const pageKey of pageKeys) {
      const pageItem = pagesObj[pageKey];
      if (
        pageItem &&
        typeof pageItem === 'object' &&
        pageItem.image &&
        typeof pageItem.image === 'object'
      ) {
        delete (pageItem.image as Record<string, unknown>).uri;
      }
    }

    const tablesArr = Array.isArray(rawJson.tables) ? rawJson.tables : [];
    const picturesArr = Array.isArray(rawJson.pictures)
      ? (rawJson.pictures as Array<Record<string, unknown>>)
      : [];
    const textsArr = Array.isArray(rawJson.texts)
      ? (rawJson.texts as Array<Record<string, unknown>>)
      : [];

    const extractedPictures = this.extractAndStripPictures(
      picturesArr,
      textsArr,
    );
    const toc = this.extractTocFromDoclingTexts(textsArr, cleanedMd);

    return {
      mdContent: cleanedMd,
      sanitizedJsonContent: rawJson,
      pageCount,
      docMetadata: {
        toc,
        processing_time: processingTime,
        total_tables: tablesArr.length,
        total_pictures: picturesArr.length,
      },
      extractedPictures,
    };
  }

  private extractAndStripPictures(
    picturesArr: Array<Record<string, unknown>>,
    textsArr: Array<Record<string, unknown>>,
  ): ExtractedDoclingPicture[] {
    const results: ExtractedDoclingPicture[] = [];

    for (let idx = 0; idx < picturesArr.length; idx++) {
      const pic = picturesArr[idx];
      if (!pic || typeof pic !== 'object') continue;

      const selfRef =
        typeof pic.self_ref === 'string' && pic.self_ref.trim()
          ? pic.self_ref.trim()
          : `#/pictures/${idx}`;

      const provArr = Array.isArray(pic.prov)
        ? (pic.prov as Array<Record<string, unknown>>)
        : [];
      const firstProv = provArr[0];
      const pageNo =
        typeof firstProv?.page_no === 'number' &&
        Number.isInteger(firstProv.page_no)
          ? firstProv.page_no
          : null;
      const bbox =
        firstProv?.bbox && typeof firstProv.bbox === 'object'
          ? (firstProv.bbox as Record<string, unknown>)
          : null;

      const { assetType, vlmDescription } = this.extractPictureAnnotations(pic);
      const caption = this.extractPictureCaption(pic, textsArr);

      const imageObj =
        pic.image && typeof pic.image === 'object'
          ? (pic.image as Record<string, unknown>)
          : null;
      const uri = typeof imageObj?.uri === 'string' ? imageObj.uri.trim() : '';

      if (imageObj && 'uri' in imageObj) {
        // Làm nhẹ chuỗi base64 bằng PNG 1x1 hợp lệ (68 bytes) để giữ nguyên tính toàn vẹn của Pydantic schema
        imageObj.uri = TRANSPARENT_1X1_PNG_DATA_URI;
      }

      if (!uri) continue;
      const match = DATA_URI_IMAGE_REGEX.exec(uri);
      if (!match) continue;

      const mimeType = match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length === 0) continue;

      results.push({
        index: idx,
        selfRef,
        assetType,
        pageNo,
        bbox,
        caption,
        vlmDescription,
        mimeType,
        buffer,
      });
    }

    return results;
  }

  private extractPictureAnnotations(pic: Record<string, unknown>): {
    assetType: string;
    vlmDescription: string | null;
  } {
    let assetType = typeof pic.label === 'string' ? pic.label : 'picture';
    const descriptions: string[] = [];

    const annotations = Array.isArray(pic.annotations)
      ? (pic.annotations as Array<Record<string, unknown>>)
      : [];

    for (const ann of annotations) {
      if (!ann || typeof ann !== 'object') continue;
      if (typeof ann.text === 'string' && ann.text.trim()) {
        descriptions.push(ann.text.trim());
      }
      const classes = Array.isArray(ann.predicted_classes)
        ? (ann.predicted_classes as Array<Record<string, unknown>>)
        : [];
      const topClass = classes[0];
      if (
        typeof topClass?.class_name === 'string' &&
        topClass.class_name.trim()
      ) {
        assetType = topClass.class_name.trim();
      }
    }

    return {
      assetType,
      vlmDescription:
        descriptions.length > 0 ? descriptions.join('\n\n') : null,
    };
  }

  private extractPictureCaption(
    pic: Record<string, unknown>,
    textsArr: Array<Record<string, unknown>>,
  ): string | null {
    const captions = Array.isArray(pic.captions)
      ? (pic.captions as Array<Record<string, unknown>>)
      : [];
    const captionTexts: string[] = [];

    for (const cap of captions) {
      if (!cap || typeof cap !== 'object') continue;
      if (typeof cap.text === 'string' && cap.text.trim()) {
        captionTexts.push(cap.text.trim());
        continue;
      }
      const ref = typeof cap.$ref === 'string' ? cap.$ref : '';
      if (ref.startsWith('#/texts/')) {
        const textIdx = Number(ref.replace('#/texts/', ''));
        const targetTextObj = textsArr[textIdx];
        if (
          targetTextObj &&
          typeof targetTextObj.text === 'string' &&
          targetTextObj.text.trim()
        ) {
          captionTexts.push(targetTextObj.text.trim());
        }
      }
    }

    return captionTexts.length > 0 ? captionTexts.join(' ') : null;
  }

  private extractTocFromDoclingTexts(
    textsArr: Array<Record<string, unknown>>,
    fallbackMarkdown: string,
  ): DoclingTocItem[] {
    const toc: DoclingTocItem[] = [];

    for (const item of textsArr) {
      if (!item || typeof item !== 'object') continue;
      const label = typeof item.label === 'string' ? item.label : '';
      if (label !== 'section_header' && label !== 'title') continue;

      const text = typeof item.text === 'string' ? item.text.trim() : '';
      if (!text) continue;

      const level =
        typeof item.level === 'number' && item.level >= 1
          ? Math.min(6, Math.floor(item.level))
          : label === 'title'
            ? 1
            : 2;

      const provArr = Array.isArray(item.prov)
        ? (item.prov as Array<Record<string, unknown>>)
        : [];
      const pageNo =
        typeof provArr[0]?.page_no === 'number' ? provArr[0].page_no : null;

      toc.push({ text, level, page_no: pageNo });
    }

    return toc.length > 0 ? toc : this.extractTocFromMarkdown(fallbackMarkdown);
  }

  public extractTocFromMarkdown(markdown: string): DoclingTocItem[] {
    if (!markdown) return [];
    const toc: DoclingTocItem[] = [];
    const lines = markdown.split('\n');

    for (const line of lines) {
      const match = /^(#{1,6})\s+(.+)$/.exec(line.trim());
      if (match) {
        toc.push({
          level: match[1].length,
          text: match[2].trim(),
          page_no: 1,
        });
      }
    }

    return toc;
  }

  /**
   * Thực thi tác vụ chunk hybrid bất đồng bộ và lấy kết quả từ Docling Server
   */
  private async executeHybridChunk(params: {
    base64String: string;
    fileName: string;
    mode: DoclingChunkSourceMode;
    actionDesc: string;
  }): Promise<DoclingChunkResult[]> {
    const reqBody = buildDoclingHybridChunkPayload({
      fileName: params.fileName,
      base64String: params.base64String,
      mode: params.mode,
      tokenizer: this.tokenizer,
      maxTokens: this.maxTokens,
    });

    this.logger.debug(
      `Gửi request chunk hybrid async tới Docling Server cho [${params.fileName}] (mode: ${params.mode})`,
    );
    const submitRes = await fetch(
      `${this.baseUrl}/v1/chunk/hybrid/source/async`,
      {
        method: 'POST',
        headers: this.buildHeaders(true),
        body: JSON.stringify(reqBody),
      },
    );

    if (!submitRes.ok) {
      const errText = await submitRes.text().catch(() => '');
      throw new Error(
        `Docling chunk request thất bại (HTTP ${submitRes.status}): ${errText}`,
      );
    }

    const submitData = (await submitRes.json()) as { task_id?: string };
    const taskId = submitData.task_id;
    if (!taskId) {
      throw new Error('Docling không trả về task_id hợp lệ cho tác vụ chunk');
    }

    await this.pollTaskStatus(taskId, params.actionDesc);

    const resultRes = await fetch(`${this.baseUrl}/v1/result/${taskId}`, {
      headers: this.buildHeaders(),
    });
    if (!resultRes.ok) {
      const errText = await resultRes.text().catch(() => '');
      throw new Error(
        `Docling get chunk result thất bại (HTTP ${resultRes.status}): ${errText}`,
      );
    }

    const resultData = (await resultRes.json()) as { chunks?: unknown[] };
    const rawChunks = resultData.chunks;

    if (!Array.isArray(rawChunks)) {
      return [];
    }

    return rawChunks
      .filter(
        (c): c is Record<string, unknown> =>
          Boolean(c) &&
          typeof c === 'object' &&
          typeof (c as Record<string, unknown>).text === 'string' &&
          ((c as Record<string, unknown>).text as string).trim().length > 0,
      )
      .map((c, defaultIdx) => this.normalizeChunkItem(c, defaultIdx));
  }

  private normalizeChunkItem(
    c: Record<string, unknown>,
    defaultIdx: number,
  ): DoclingChunkResult {
    const content = (c.text as string).trim();
    const rawContent =
      typeof c.raw_text === 'string' && c.raw_text.trim().length > 0
        ? c.raw_text.trim()
        : typeof c.raw_content === 'string' && c.raw_content.trim().length > 0
          ? c.raw_content.trim()
          : content;

    const meta =
      c.meta && typeof c.meta === 'object'
        ? (c.meta as Record<string, unknown>)
        : {};

    const headings = Array.isArray(meta.headings)
      ? meta.headings.filter((h): h is string => typeof h === 'string')
      : Array.isArray(c.headings)
        ? c.headings.filter((h): h is string => typeof h === 'string')
        : [];

    const docItems = Array.isArray(meta.doc_items)
      ? (meta.doc_items as Array<Record<string, unknown>>)
      : [];

    const { pageNumbers, bboxes, selfRefs, labels } =
      this.extractDocItemsDetails(docItems, c.page_numbers);

    const hasTable =
      c.has_table === true ||
      labels.has('table') ||
      labels.has('document_index');
    const hasImage =
      c.has_image === true ||
      meta.has_image === true ||
      labels.has('picture') ||
      labels.has('figure') ||
      labels.has('chart') ||
      selfRefs.some((ref) => ref.startsWith('#/pictures/'));

    const chunkType = this.inferChunkType(c, labels, hasTable, hasImage);

    const tokenCount =
      typeof c.num_tokens === 'number'
        ? c.num_tokens
        : typeof c.token_count === 'number'
          ? c.token_count
          : Math.max(1, Math.ceil(content.length / 4));

    return {
      index: typeof c.chunk_index === 'number' ? c.chunk_index : defaultIdx,
      pageNumbers,
      content,
      rawContent,
      tokenCount,
      headings,
      bboxes,
      chunkType,
      hasImage,
      hasTable,
      metadata: {
        ...meta,
        self_refs: selfRefs,
      },
    };
  }

  private extractDocItemsDetails(
    docItems: Array<Record<string, unknown>>,
    topLevelPageNumbers: unknown,
  ): {
    pageNumbers: number[];
    bboxes: DoclingChunkBboxItem[];
    selfRefs: string[];
    labels: Set<string>;
  } {
    const pageSet = new Set<number>();
    const bboxes: DoclingChunkBboxItem[] = [];
    const selfRefSet = new Set<string>();
    const labels = new Set<string>();

    if (Array.isArray(topLevelPageNumbers)) {
      for (const p of topLevelPageNumbers) {
        if (typeof p === 'number' && Number.isInteger(p) && p > 0) {
          pageSet.add(p);
        }
      }
    }

    for (const item of docItems) {
      if (!item || typeof item !== 'object') continue;
      const selfRef =
        typeof item.self_ref === 'string' ? item.self_ref : null;
      const label = typeof item.label === 'string' ? item.label : null;

      if (selfRef) selfRefSet.add(selfRef);
      if (label) labels.add(label.toLowerCase());

      const provList = Array.isArray(item.prov)
        ? (item.prov as Array<Record<string, unknown>>)
        : [];

      for (const prov of provList) {
        if (!prov || typeof prov !== 'object') continue;
        const pageNo =
          typeof prov.page_no === 'number' &&
          Number.isInteger(prov.page_no) &&
          prov.page_no > 0
            ? prov.page_no
            : null;
        if (pageNo !== null) {
          pageSet.add(pageNo);
        }

        const bbox =
          prov.bbox && typeof prov.bbox === 'object'
            ? (prov.bbox as Record<string, unknown>)
            : null;

        bboxes.push({
          self_ref: selfRef,
          label,
          page_no: pageNo,
          bbox,
        });
      }
    }

    const sortedPages = Array.from(pageSet).sort((a, b) => a - b);
    return {
      pageNumbers: sortedPages,
      bboxes,
      selfRefs: Array.from(selfRefSet),
      labels,
    };
  }

  private inferChunkType(
    c: Record<string, unknown>,
    labels: Set<string>,
    hasTable: boolean,
    hasImage: boolean,
  ): DoclingChunkType {
    const explicitType = (c.chunk_type ?? c.type) as string | undefined;
    if (
      explicitType &&
      ['text', 'table', 'code', 'formula', 'image_desc', 'mixed'].includes(
        explicitType,
      )
    ) {
      return explicitType as DoclingChunkType;
    }

    const specializedCategories = new Set<DoclingChunkType>();
    if (hasTable) specializedCategories.add('table');
    if (hasImage) specializedCategories.add('image_desc');
    if (labels.has('code')) specializedCategories.add('code');
    if (labels.has('formula') || labels.has('equation')) {
      specializedCategories.add('formula');
    }

    if (specializedCategories.size > 1) {
      return 'mixed';
    }
    if (specializedCategories.size === 1) {
      return Array.from(specializedCategories)[0];
    }
    return 'text';
  }

  /**
   * Polling trạng thái tác vụ bất đồng bộ trên Docling Server
   */
  private async pollTaskStatus(
    taskId: string,
    actionName: string,
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < this.timeoutMs) {
      try {
        const pollUrl = `${this.baseUrl}/v1/status/poll/${taskId}?wait=${this.pollWaitSeconds}`;
        const res = await fetch(pollUrl, {
          headers: this.buildHeaders(),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(`Docling poll status HTTP ${res.status}: ${errText}`);
        }

        const data = (await res.json()) as {
          task_status?: string;
          error_message?: string;
        };
        const status = data.task_status;

        if (status === 'success') {
          return;
        }

        if (status === 'failure') {
          throw new DoclingTaskError(
            data.error_message || `Docling task [${taskId}] thất bại`,
          );
        }

        await new Promise((resolve) =>
          setTimeout(resolve, this.pollIntervalMs),
        );
      } catch (err: unknown) {
        if (err instanceof DoclingTaskError) {
          throw err;
        }
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Lỗi tạm thời khi polling task [${taskId}] (${actionName}): ${message}`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, this.pollIntervalMs),
        );
      }
    }

    throw new Error(
      `Quá thời gian chờ (${this.timeoutMs / 1000}s) khi xử lý Docling task [${taskId}] cho ${actionName}`,
    );
  }
}
