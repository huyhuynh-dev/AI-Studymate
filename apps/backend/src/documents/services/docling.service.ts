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

interface DomProvEntry {
  page_no: number | null;
  bbox: Record<string, unknown> | null;
}

interface DomIndexedItem {
  selfRef: string;
  label: string;
  provs: DomProvEntry[];
  normalizedText: string;
}

interface PictureEnrichmentMeta {
  selfRef: string;
  assetType: string;
  pageNo: number | null;
  bbox: Record<string, unknown> | null;
  caption: string | null;
  vlmDescription: string | null;
}

interface DoclingDomLookupIndex {
  byRef: Map<string, DomIndexedItem>;
  childOrCaptionToParentRefs: Map<string, string[]>;
  pictures: PictureEnrichmentMeta[];
}

const DATA_URI_IMAGE_REGEX =
  /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/;
const MARKDOWN_BASE64_IMAGE_REGEX =
  /!\[([^\]]*)\]\(data:image\/[a-zA-Z0-9.+-]+;base64,[^)]+\)/g;
const MARKDOWN_PICTURE_REF_REGEX = /#\/pictures\/\d+/g;
const MARKDOWN_TABLE_SEPARATOR_REGEX = /\|\s*:?-{3,}:?\s*\|/;
const MARKDOWN_CODE_FENCE_REGEX = /```/;
const MARKDOWN_DISPLAY_FORMULA_REGEX = /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]/;
const MARKDOWN_IMAGE_TAG_REGEX = /!\[[^\]]*\]/;

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
   * và làm nhẹ chuỗi Base64 nặng trong JSON bằng PNG 1x1 hợp lệ để sẵn sàng lưu R2 & chuyển tiếp sang HybridChunker.
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
   * đã được Convert ở Bước 1 sang API HybridChunker, sau đó giải tham chiếu JSON Pointer
   * và làm giàu đầy đủ bboxes, page_numbers, self_refs, chunk_type.
   */
  async chunkFromDoclingJson(
    sanitizedJsonContent: Record<string, unknown>,
    originalFileName: string,
    extractedPictures?: ExtractedDoclingPicture[],
  ): Promise<DoclingChunkResult[]> {
    const jsonString = JSON.stringify(sanitizedJsonContent);
    const base64String = Buffer.from(jsonString, 'utf-8').toString('base64');
    const baseName = originalFileName.replace(/\.[^.]+$/, '') || 'document';
    const jsonFileName = `${baseName}.json`;

    const rawChunks = await this.executeHybridChunk({
      base64String,
      fileName: jsonFileName,
      mode: 'json_docling',
      actionDesc: `chunk json_docling [${jsonFileName}]`,
    });

    return this.enrichChunksWithDoclingJson(
      rawChunks,
      sanitizedJsonContent,
      extractedPictures,
    );
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

  /**
   * Post-Chunking Enrichment:
   * 1. Giải tham chiếu trực tiếp các JSON Pointer trong chunk.metadata.self_refs (ví dụ "#/texts/0", "#/tables/0", "#/pictures/1")
   *    sang tọa độ prov[].bbox, prov[].page_no và label từ sanitizedJsonContent.
   * 2. Hỗ trợ liên kết bắc cầu: nếu chunk chứa caption (#/texts/k) của một ảnh (#/pictures/m) hoặc bảng (#/tables/n),
   *    tự động gắn thêm self_ref và bbox của ảnh/bảng đó vào chunk.
   * 3. Ánh xạ ngược theo nội dung/trang khi chunk đến từ Fallback Markdown (bboxes hoặc self_refs rỗng).
   * 4. Đảm bảo 100% hình ảnh (extractedPictures / pictures) được gắn vào chunk phù hợp nhất.
   * 5. Phát hiện trực tiếp trên chunk.content cho bảng Markdown (| --- |), khối code (```), công thức ($$) và ảnh.
   */
  public enrichChunksWithDoclingJson(
    chunks: DoclingChunkResult[],
    sanitizedJsonContent?: Record<string, unknown> | null,
    extractedPictures?: ExtractedDoclingPicture[],
  ): DoclingChunkResult[] {
    if (chunks.length === 0) {
      return [];
    }

    const domIndex = this.buildDomLookupIndex(
      sanitizedJsonContent ?? null,
      extractedPictures ?? [],
    );

    const enriched = chunks.map((chunk) =>
      this.enrichSingleChunkFromDom(chunk, domIndex),
    );

    this.assignUnmatchedPicturesToChunks(enriched, domIndex.pictures);

    return enriched.map((chunk) => this.finalizeChunkClassification(chunk));
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

    // Làm nhẹ chuỗi base64 ảnh chụp toàn trang trong pages.*.image.uri bằng PNG 1x1 hợp lệ
    for (const pageKey of pageKeys) {
      const pageItem = pagesObj[pageKey];
      if (
        pageItem &&
        typeof pageItem === 'object' &&
        pageItem.image &&
        typeof pageItem.image === 'object' &&
        'uri' in pageItem.image
      ) {
        (pageItem.image as Record<string, unknown>).uri =
          TRANSPARENT_1X1_PNG_DATA_URI;
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

      const provs = this.extractProvEntries(pic.prov);
      const firstProv = provs[0];
      const pageNo = firstProv?.page_no ?? null;
      const bbox = firstProv?.bbox ?? null;

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

  /**
   * Trích xuất assetType và vlmDescription từ cả chuẩn mới `pic.meta` (Docling 2.x PictureMeta)
   * lẫn chuẩn cũ `pic.annotations` (legacy PictureDataType[]).
   */
  private extractPictureAnnotations(pic: Record<string, unknown>): {
    assetType: string;
    vlmDescription: string | null;
  } {
    let assetType = typeof pic.label === 'string' ? pic.label : 'picture';
    const descriptions: string[] = [];

    const addDescription = (text: unknown) => {
      if (typeof text !== 'string') return;
      const trimmed = text.trim();
      if (trimmed && !descriptions.includes(trimmed)) {
        descriptions.push(trimmed);
      }
    };

    // 1. Đọc từ pic.meta (Docling 2.x PictureMeta: description + classification)
    const picMeta =
      pic.meta && typeof pic.meta === 'object'
        ? (pic.meta as Record<string, unknown>)
        : null;
    if (picMeta) {
      const descField =
        picMeta.description && typeof picMeta.description === 'object'
          ? (picMeta.description as Record<string, unknown>)
          : null;
      if (descField) {
        addDescription(descField.text);
      }

      const classField =
        picMeta.classification && typeof picMeta.classification === 'object'
          ? (picMeta.classification as Record<string, unknown>)
          : null;
      const predictions = Array.isArray(classField?.predictions)
        ? (classField.predictions as Array<Record<string, unknown>>)
        : [];
      const topPrediction = predictions[0];
      if (
        typeof topPrediction?.class_name === 'string' &&
        topPrediction.class_name.trim()
      ) {
        assetType = topPrediction.class_name.trim();
      }
    }

    // 2. Đọc từ pic.annotations (Legacy PictureDataType[])
    const annotations = Array.isArray(pic.annotations)
      ? (pic.annotations as Array<Record<string, unknown>>)
      : [];

    for (const ann of annotations) {
      if (!ann || typeof ann !== 'object') continue;
      addDescription(ann.text);

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

    const topMetadata =
      c.metadata && typeof c.metadata === 'object'
        ? (c.metadata as Record<string, unknown>)
        : {};
    const legacyMeta =
      c.meta && typeof c.meta === 'object'
        ? (c.meta as Record<string, unknown>)
        : {};
    const meta: Record<string, unknown> = {
      ...legacyMeta,
      ...topMetadata,
    };

    const headings = Array.isArray(c.headings)
      ? c.headings.filter((h): h is string => typeof h === 'string')
      : Array.isArray(meta.headings)
        ? meta.headings.filter((h): h is string => typeof h === 'string')
        : [];

    const captions = Array.isArray(c.captions)
      ? c.captions.filter((cap): cap is string => typeof cap === 'string')
      : Array.isArray(meta.captions)
        ? meta.captions.filter((cap): cap is string => typeof cap === 'string')
        : [];

    const rawDocItems = Array.isArray(c.doc_items)
      ? c.doc_items
      : Array.isArray(meta.doc_items)
        ? meta.doc_items
        : [];

    const { pageNumbers, bboxes, selfRefs, labels } =
      this.extractDocItemsDetails(rawDocItems, c.page_numbers);

    this.applyContentHeuristics(content, selfRefs, labels);

    const hasTable =
      c.has_table === true ||
      meta.has_table === true ||
      labels.has('table') ||
      labels.has('document_index') ||
      selfRefs.some((ref) => ref.startsWith('#/tables/'));

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

    const chunkMetadata: Record<string, unknown> = {
      ...meta,
      self_refs: selfRefs,
    };
    if (captions.length > 0) {
      chunkMetadata.captions = captions;
    }

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
      metadata: chunkMetadata,
    };
  }

  /**
   * Đọc danh sách doc_items hỗ trợ cả 2 định dạng:
   * 1. Chuỗi JSON Pointer từ ChunkedDocumentResultItem của docling-serve ("#/texts/0", "#/tables/0", "#/pictures/1")
   * 2. Object inline ({ self_ref, label, prov })
   */
  private extractDocItemsDetails(
    docItems: unknown[],
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
      if (typeof item === 'string') {
        const ref = item.trim();
        if (!ref) continue;
        selfRefSet.add(ref);
        this.inferLabelFromPointer(ref, labels);
        continue;
      }

      if (!item || typeof item !== 'object') continue;
      const itemObj = item as Record<string, unknown>;
      const selfRef =
        typeof itemObj.self_ref === 'string' && itemObj.self_ref.trim()
          ? itemObj.self_ref.trim()
          : typeof itemObj.ref === 'string' && itemObj.ref.trim()
            ? itemObj.ref.trim()
            : null;
      const label =
        typeof itemObj.label === 'string' && itemObj.label.trim()
          ? itemObj.label.trim()
          : null;

      if (selfRef) {
        selfRefSet.add(selfRef);
        this.inferLabelFromPointer(selfRef, labels);
      }
      if (label) {
        labels.add(label.toLowerCase());
      }

      const provs = this.extractProvEntries(itemObj.prov);
      for (const prov of provs) {
        if (prov.page_no !== null) {
          pageSet.add(prov.page_no);
        }
        bboxes.push({
          self_ref: selfRef,
          label,
          page_no: prov.page_no,
          bbox: prov.bbox,
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

  private inferLabelFromPointer(ref: string, labels: Set<string>): void {
    if (ref.startsWith('#/tables/')) {
      labels.add('table');
    } else if (ref.startsWith('#/pictures/')) {
      labels.add('picture');
    }
  }

  /**
   * Phát hiện trực tiếp trên nội dung văn bản của chunk:
   * - Bảng Markdown (| --- | hoặc |---|)
   * - Khối code (```)
   * - Công thức toán học ($$ ... $$ hoặc \[ ... \])
   * - Tham chiếu hình ảnh (#/pictures/idx hoặc ![...])
   */
  private applyContentHeuristics(
    content: string,
    selfRefs: string[],
    labels: Set<string>,
  ): void {
    if (!content) return;

    if (MARKDOWN_TABLE_SEPARATOR_REGEX.test(content)) {
      labels.add('table');
    }
    if (MARKDOWN_CODE_FENCE_REGEX.test(content)) {
      labels.add('code');
    }
    if (MARKDOWN_DISPLAY_FORMULA_REGEX.test(content)) {
      labels.add('formula');
    }
    if (MARKDOWN_IMAGE_TAG_REGEX.test(content)) {
      labels.add('picture');
    }

    const matchedPicRefs = content.match(MARKDOWN_PICTURE_REF_REGEX);
    if (matchedPicRefs) {
      for (const picRef of matchedPicRefs) {
        if (!selfRefs.includes(picRef)) {
          selfRefs.push(picRef);
        }
        labels.add('picture');
      }
    }
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

    return this.computeChunkTypeFromSignals(labels, hasTable, hasImage);
  }

  private computeChunkTypeFromSignals(
    labels: Set<string>,
    hasTable: boolean,
    hasImage: boolean,
  ): DoclingChunkType {
    const specializedCategories = new Set<DoclingChunkType>();
    if (hasTable || labels.has('table') || labels.has('document_index')) {
      specializedCategories.add('table');
    }
    if (
      hasImage ||
      labels.has('picture') ||
      labels.has('figure') ||
      labels.has('chart')
    ) {
      specializedCategories.add('image_desc');
    }
    if (labels.has('code')) {
      specializedCategories.add('code');
    }
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
   * Xây dựng chỉ mục tra cứu O(1) từ sanitizedJsonContent và extractedPictures
   */
  private buildDomLookupIndex(
    sanitizedJsonContent: Record<string, unknown> | null,
    extractedPictures: ExtractedDoclingPicture[],
  ): DoclingDomLookupIndex {
    const byRef = new Map<string, DomIndexedItem>();
    const childOrCaptionToParentRefs = new Map<string, string[]>();
    const picturesMap = new Map<string, PictureEnrichmentMeta>();

    for (const pic of extractedPictures) {
      picturesMap.set(pic.selfRef, {
        selfRef: pic.selfRef,
        assetType: pic.assetType || 'picture',
        pageNo: pic.pageNo,
        bbox: pic.bbox,
        caption: pic.caption,
        vlmDescription: pic.vlmDescription,
      });
    }

    if (!sanitizedJsonContent) {
      return {
        byRef,
        childOrCaptionToParentRefs,
        pictures: Array.from(picturesMap.values()),
      };
    }

    const textsArr = Array.isArray(sanitizedJsonContent.texts)
      ? (sanitizedJsonContent.texts as Array<Record<string, unknown>>)
      : [];
    this.indexDomCollection(textsArr, 'texts', 'text', byRef);

    const tablesArr = Array.isArray(sanitizedJsonContent.tables)
      ? (sanitizedJsonContent.tables as Array<Record<string, unknown>>)
      : [];
    this.indexDomTables(
      tablesArr,
      textsArr,
      byRef,
      childOrCaptionToParentRefs,
    );

    const picturesArr = Array.isArray(sanitizedJsonContent.pictures)
      ? (sanitizedJsonContent.pictures as Array<Record<string, unknown>>)
      : [];
    this.indexDomPictures(
      picturesArr,
      textsArr,
      byRef,
      childOrCaptionToParentRefs,
      picturesMap,
    );

    const kvArr = Array.isArray(sanitizedJsonContent.key_value_items)
      ? (sanitizedJsonContent.key_value_items as Array<Record<string, unknown>>)
      : [];
    this.indexDomCollection(kvArr, 'key_value_items', 'key_value_region', byRef);

    const formArr = Array.isArray(sanitizedJsonContent.form_items)
      ? (sanitizedJsonContent.form_items as Array<Record<string, unknown>>)
      : [];
    this.indexDomCollection(formArr, 'form_items', 'form', byRef);

    return {
      byRef,
      childOrCaptionToParentRefs,
      pictures: Array.from(picturesMap.values()),
    };
  }

  private indexDomCollection(
    items: Array<Record<string, unknown>>,
    collectionName: string,
    defaultLabel: string,
    byRef: Map<string, DomIndexedItem>,
  ): void {
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      if (!item || typeof item !== 'object') continue;

      const selfRef =
        typeof item.self_ref === 'string' && item.self_ref.trim()
          ? item.self_ref.trim()
          : `#/${collectionName}/${idx}`;
      const label =
        typeof item.label === 'string' && item.label.trim()
          ? item.label.trim()
          : defaultLabel;
      const rawText = typeof item.text === 'string' ? item.text.trim() : '';

      byRef.set(selfRef, {
        selfRef,
        label,
        provs: this.extractProvEntries(item.prov),
        normalizedText: this.normalizeTextForMatch(rawText),
      });
    }
  }

  private indexDomTables(
    tablesArr: Array<Record<string, unknown>>,
    textsArr: Array<Record<string, unknown>>,
    byRef: Map<string, DomIndexedItem>,
    childOrCaptionToParentRefs: Map<string, string[]>,
  ): void {
    for (let idx = 0; idx < tablesArr.length; idx++) {
      const tbl = tablesArr[idx];
      if (!tbl || typeof tbl !== 'object') continue;

      const selfRef =
        typeof tbl.self_ref === 'string' && tbl.self_ref.trim()
          ? tbl.self_ref.trim()
          : `#/tables/${idx}`;
      const label =
        typeof tbl.label === 'string' && tbl.label.trim()
          ? tbl.label.trim()
          : 'table';

      this.registerParentBackrefs(tbl, selfRef, childOrCaptionToParentRefs);

      const caption = this.extractPictureCaption(tbl, textsArr) ?? '';
      const cellTexts = this.extractTableCellTextSample(tbl);
      const combinedText = `${caption} ${cellTexts}`.trim();

      byRef.set(selfRef, {
        selfRef,
        label,
        provs: this.extractProvEntries(tbl.prov),
        normalizedText: this.normalizeTextForMatch(combinedText),
      });
    }
  }

  private indexDomPictures(
    picturesArr: Array<Record<string, unknown>>,
    textsArr: Array<Record<string, unknown>>,
    byRef: Map<string, DomIndexedItem>,
    childOrCaptionToParentRefs: Map<string, string[]>,
    picturesMap: Map<string, PictureEnrichmentMeta>,
  ): void {
    for (let idx = 0; idx < picturesArr.length; idx++) {
      const pic = picturesArr[idx];
      if (!pic || typeof pic !== 'object') continue;

      const selfRef =
        typeof pic.self_ref === 'string' && pic.self_ref.trim()
          ? pic.self_ref.trim()
          : `#/pictures/${idx}`;
      const { assetType, vlmDescription } = this.extractPictureAnnotations(pic);
      const caption = this.extractPictureCaption(pic, textsArr);
      const provs = this.extractProvEntries(pic.prov);

      this.registerParentBackrefs(pic, selfRef, childOrCaptionToParentRefs);

      const combinedText = [caption ?? '', vlmDescription ?? '']
        .filter(Boolean)
        .join(' ');

      byRef.set(selfRef, {
        selfRef,
        label: assetType || 'picture',
        provs,
        normalizedText: this.normalizeTextForMatch(combinedText),
      });

      if (!picturesMap.has(selfRef)) {
        picturesMap.set(selfRef, {
          selfRef,
          assetType: assetType || 'picture',
          pageNo: provs[0]?.page_no ?? null,
          bbox: provs[0]?.bbox ?? null,
          caption,
          vlmDescription,
        });
      }
    }
  }

  private registerParentBackrefs(
    node: Record<string, unknown>,
    parentSelfRef: string,
    childOrCaptionToParentRefs: Map<string, string[]>,
  ): void {
    const linkArrays = [node.captions, node.footnotes, node.children];
    for (const arr of linkArrays) {
      if (!Array.isArray(arr)) continue;
      for (const refObj of arr) {
        if (!refObj || typeof refObj !== 'object') continue;
        const childRef = (refObj as Record<string, unknown>).$ref;
        if (typeof childRef !== 'string' || !childRef.trim()) continue;
        const normalizedChildRef = childRef.trim();
        const existing =
          childOrCaptionToParentRefs.get(normalizedChildRef) ?? [];
        if (!existing.includes(parentSelfRef)) {
          existing.push(parentSelfRef);
          childOrCaptionToParentRefs.set(normalizedChildRef, existing);
        }
      }
    }
  }

  private extractTableCellTextSample(tbl: Record<string, unknown>): string {
    const dataObj =
      tbl.data && typeof tbl.data === 'object'
        ? (tbl.data as Record<string, unknown>)
        : null;
    if (!dataObj) return '';

    const cells = Array.isArray(dataObj.table_cells)
      ? (dataObj.table_cells as Array<Record<string, unknown>>)
      : [];
    const snippets: string[] = [];

    for (const cell of cells.slice(0, 12)) {
      if (cell && typeof cell.text === 'string' && cell.text.trim()) {
        snippets.push(cell.text.trim());
      }
    }
    return snippets.join(' ');
  }

  private extractProvEntries(provInput: unknown): DomProvEntry[] {
    if (!Array.isArray(provInput)) return [];
    const entries: DomProvEntry[] = [];

    for (const p of provInput) {
      if (!p || typeof p !== 'object') continue;
      const provObj = p as Record<string, unknown>;
      const pageNo =
        typeof provObj.page_no === 'number' &&
        Number.isInteger(provObj.page_no) &&
        provObj.page_no > 0
          ? provObj.page_no
          : null;
      const bbox =
        provObj.bbox && typeof provObj.bbox === 'object'
          ? (provObj.bbox as Record<string, unknown>)
          : null;
      entries.push({ page_no: pageNo, bbox });
    }

    return entries;
  }

  private enrichSingleChunkFromDom(
    chunk: DoclingChunkResult,
    domIndex: DoclingDomLookupIndex,
  ): DoclingChunkResult {
    const pageSet = new Set<number>(chunk.pageNumbers ?? []);
    const bboxes: DoclingChunkBboxItem[] = [...(chunk.bboxes ?? [])];
    const bboxKeys = new Set<string>(
      bboxes.map((b) => this.buildBboxDedupKey(b)),
    );

    const existingRefs = Array.isArray(chunk.metadata?.self_refs)
      ? (chunk.metadata.self_refs as unknown[]).filter(
          (r): r is string => typeof r === 'string' && r.trim().length > 0,
        )
      : [];
    const selfRefSet = new Set<string>(existingRefs);
    const labels = new Set<string>();

    // Mở rộng liên kết bắc cầu (nếu chunk chứa caption/child của ảnh hoặc bảng)
    for (const ref of Array.from(selfRefSet)) {
      const parentRefs = domIndex.childOrCaptionToParentRefs.get(ref);
      if (!parentRefs) continue;
      for (const parentRef of parentRefs) {
        selfRefSet.add(parentRef);
      }
    }

    // 1. Giải tham chiếu trực tiếp tất cả self_refs qua domIndex.byRef
    for (const ref of selfRefSet) {
      this.inferLabelFromPointer(ref, labels);
      const domItem = domIndex.byRef.get(ref);
      if (!domItem) continue;

      labels.add(domItem.label.toLowerCase());
      for (const prov of domItem.provs) {
        if (prov.page_no !== null) {
          pageSet.add(prov.page_no);
        }
        this.addUniqueBbox(
          bboxes,
          bboxKeys,
          domItem.selfRef,
          domItem.label,
          prov.page_no,
          prov.bbox,
        );
      }
    }

    // 2. Nếu bboxes hoặc self_refs vẫn rỗng (ví dụ chạy qua Fallback Markdown), ánh xạ ngược theo nội dung
    if (
      (bboxes.length === 0 || selfRefSet.size === 0) &&
      domIndex.byRef.size > 0
    ) {
      this.reverseMatchChunkWithDomItems(
        chunk,
        domIndex,
        selfRefSet,
        pageSet,
        bboxes,
        bboxKeys,
        labels,
      );
    }

    const sortedPages = Array.from(pageSet).sort((a, b) => a - b);
    const finalPages = sortedPages.length > 0 ? sortedPages : [1];
    const finalSelfRefs = Array.from(selfRefSet);

    return {
      ...chunk,
      pageNumbers: finalPages,
      bboxes,
      metadata: {
        ...chunk.metadata,
        self_refs: finalSelfRefs,
      },
    };
  }

  private reverseMatchChunkWithDomItems(
    chunk: DoclingChunkResult,
    domIndex: DoclingDomLookupIndex,
    selfRefSet: Set<string>,
    pageSet: Set<number>,
    bboxes: DoclingChunkBboxItem[],
    bboxKeys: Set<string>,
    labels: Set<string>,
  ): void {
    const normalizedChunkText = this.normalizeTextForMatch(
      `${chunk.content} ${chunk.rawContent ?? ''}`,
    );
    if (!normalizedChunkText) return;

    for (const domItem of domIndex.byRef.values()) {
      if (!domItem.normalizedText || domItem.normalizedText.length < 8) {
        continue;
      }

      const probe =
        domItem.normalizedText.length > 80
          ? domItem.normalizedText.slice(0, 80)
          : domItem.normalizedText;

      const isMatch =
        normalizedChunkText.includes(probe) ||
        (normalizedChunkText.length >= 20 &&
          domItem.normalizedText.includes(normalizedChunkText.slice(0, 60)));

      if (!isMatch) continue;

      selfRefSet.add(domItem.selfRef);
      labels.add(domItem.label.toLowerCase());

      // Nếu phần tử khớp là caption của ảnh/bảng, kéo theo cả ảnh/bảng cha
      const parentRefs = domIndex.childOrCaptionToParentRefs.get(
        domItem.selfRef,
      );
      if (parentRefs) {
        for (const pRef of parentRefs) {
          selfRefSet.add(pRef);
          const parentItem = domIndex.byRef.get(pRef);
          if (parentItem) {
            labels.add(parentItem.label.toLowerCase());
            for (const prov of parentItem.provs) {
              if (prov.page_no !== null) pageSet.add(prov.page_no);
              this.addUniqueBbox(
                bboxes,
                bboxKeys,
                parentItem.selfRef,
                parentItem.label,
                prov.page_no,
                prov.bbox,
              );
            }
          }
        }
      }

      for (const prov of domItem.provs) {
        if (prov.page_no !== null) {
          pageSet.add(prov.page_no);
        }
        this.addUniqueBbox(
          bboxes,
          bboxKeys,
          domItem.selfRef,
          domItem.label,
          prov.page_no,
          prov.bbox,
        );
      }
    }
  }

  /**
   * Đảm bảo 100% các hình ảnh (pictures) trong tài liệu đều được gắn vào ít nhất 1 chunk
   * thông qua 3 tầng đối chiếu:
   * - Tầng 1: Đã có sẵn self_ref trong chunk.metadata.self_refs
   * - Tầng 2: Cùng page_no (hoặc bất kỳ trang nào) và chunk.content chứa caption hoặc vlm_description
   * - Tầng 3: Cùng page_no (ưu tiên chunk có ![IMAGE] / hasImage, hoặc chunk đầu tiên trên trang đó)
   */
  private assignUnmatchedPicturesToChunks(
    chunks: DoclingChunkResult[],
    pictures: PictureEnrichmentMeta[],
  ): void {
    if (chunks.length === 0 || pictures.length === 0) return;

    for (const pic of pictures) {
      const alreadyMatchedChunks = chunks.filter((c) => {
        const refs = Array.isArray(c.metadata?.self_refs)
          ? (c.metadata.self_refs as unknown[])
          : [];
        return refs.includes(pic.selfRef);
      });

      if (alreadyMatchedChunks.length > 0) {
        for (const matched of alreadyMatchedChunks) {
          this.attachPictureToChunk(matched, pic);
        }
        continue;
      }

      const targetChunk = this.findBestChunkForPicture(chunks, pic);
      if (targetChunk) {
        this.attachPictureToChunk(targetChunk, pic);
      }
    }
  }

  private findBestChunkForPicture(
    chunks: DoclingChunkResult[],
    pic: PictureEnrichmentMeta,
  ): DoclingChunkResult | null {
    const captionProbe = this.buildMatchProbe(pic.caption);
    const vlmProbe = this.buildMatchProbe(pic.vlmDescription);

    const samePageChunks =
      pic.pageNo !== null
        ? chunks.filter((c) => c.pageNumbers.includes(pic.pageNo!))
        : [];
    const candidatePool = samePageChunks.length > 0 ? samePageChunks : chunks;

    // Tầng 2: Khớp theo caption hoặc vlm_description trên candidatePool (ưu tiên cùng trang)
    if (captionProbe || vlmProbe) {
      for (const candidate of candidatePool) {
        const normContent = this.normalizeTextForMatch(
          `${candidate.content} ${candidate.rawContent ?? ''}`,
        );
        if (
          (captionProbe && normContent.includes(captionProbe)) ||
          (vlmProbe && normContent.includes(vlmProbe))
        ) {
          return candidate;
        }
      }

      // Thử trên toàn bộ chunks nếu tìm trong cùng trang chưa khớp
      if (candidatePool !== chunks) {
        for (const candidate of chunks) {
          const normContent = this.normalizeTextForMatch(
            `${candidate.content} ${candidate.rawContent ?? ''}`,
          );
          if (
            (captionProbe && normContent.includes(captionProbe)) ||
            (vlmProbe && normContent.includes(vlmProbe))
          ) {
            return candidate;
          }
        }
      }
    }

    // Tầng 3: Cùng page_no (ưu tiên chunk có placeholder ảnh hoặc hasImage)
    if (samePageChunks.length > 0) {
      const imageBearingChunk = samePageChunks.find(
        (c) => c.hasImage || MARKDOWN_IMAGE_TAG_REGEX.test(c.content),
      );
      return imageBearingChunk ?? samePageChunks[0];
    }

    // Fallback cuối cùng: tìm chunk có số trang gần nhất hoặc chunk đầu tiên
    if (pic.pageNo !== null) {
      let closest = chunks[0];
      let minDiff = Number.MAX_SAFE_INTEGER;
      for (const c of chunks) {
        for (const p of c.pageNumbers) {
          const diff = Math.abs(p - pic.pageNo);
          if (diff < minDiff) {
            minDiff = diff;
            closest = c;
          }
        }
      }
      return closest;
    }

    return chunks[0];
  }

  private attachPictureToChunk(
    chunk: DoclingChunkResult,
    pic: PictureEnrichmentMeta,
  ): void {
    const refs = Array.isArray(chunk.metadata?.self_refs)
      ? [...(chunk.metadata.self_refs as string[])]
      : [];
    if (!refs.includes(pic.selfRef)) {
      refs.push(pic.selfRef);
    }
    chunk.metadata = {
      ...chunk.metadata,
      self_refs: refs,
    };

    if (pic.pageNo !== null && !chunk.pageNumbers.includes(pic.pageNo)) {
      chunk.pageNumbers = [...chunk.pageNumbers, pic.pageNo].sort(
        (a, b) => a - b,
      );
    }

    const bboxes = chunk.bboxes ?? [];
    const bboxKeys = new Set<string>(
      bboxes.map((b) => this.buildBboxDedupKey(b)),
    );
    this.addUniqueBbox(
      bboxes,
      bboxKeys,
      pic.selfRef,
      pic.assetType || 'picture',
      pic.pageNo,
      pic.bbox,
    );
    chunk.bboxes = bboxes;
    chunk.hasImage = true;
  }

  private finalizeChunkClassification(
    chunk: DoclingChunkResult,
  ): DoclingChunkResult {
    const selfRefs = Array.isArray(chunk.metadata?.self_refs)
      ? (chunk.metadata.self_refs as unknown[]).filter(
          (r): r is string => typeof r === 'string',
        )
      : [];
    const labels = new Set<string>();

    for (const ref of selfRefs) {
      this.inferLabelFromPointer(ref, labels);
    }
    for (const bboxItem of chunk.bboxes ?? []) {
      if (bboxItem.label) {
        labels.add(bboxItem.label.toLowerCase());
      }
    }

    this.applyContentHeuristics(chunk.content, selfRefs, labels);

    const hasTable =
      chunk.hasTable === true ||
      labels.has('table') ||
      labels.has('document_index') ||
      selfRefs.some((r) => r.startsWith('#/tables/'));

    const hasImage =
      chunk.hasImage === true ||
      labels.has('picture') ||
      labels.has('figure') ||
      labels.has('chart') ||
      selfRefs.some((r) => r.startsWith('#/pictures/'));

    const chunkType = this.computeChunkTypeFromSignals(
      labels,
      hasTable,
      hasImage,
    );

    return {
      ...chunk,
      pageNumbers: chunk.pageNumbers.length > 0 ? chunk.pageNumbers : [1],
      bboxes: chunk.bboxes ?? [],
      hasTable,
      hasImage,
      chunkType,
      metadata: {
        ...chunk.metadata,
        self_refs: selfRefs,
      },
    };
  }

  private addUniqueBbox(
    bboxes: DoclingChunkBboxItem[],
    bboxKeys: Set<string>,
    selfRef: string | null,
    label: string | null,
    pageNo: number | null,
    bbox: Record<string, unknown> | null,
  ): void {
    const candidate: DoclingChunkBboxItem = {
      self_ref: selfRef,
      label,
      page_no: pageNo,
      bbox,
    };
    const key = this.buildBboxDedupKey(candidate);
    if (!bboxKeys.has(key)) {
      bboxKeys.add(key);
      bboxes.push(candidate);
    }
  }

  private buildBboxDedupKey(item: DoclingChunkBboxItem): string {
    return `${item.self_ref ?? ''}|${item.page_no ?? ''}|${item.bbox ? JSON.stringify(item.bbox) : ''}`;
  }

  private normalizeTextForMatch(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildMatchProbe(text: string | null | undefined): string | null {
    if (!text) return null;
    const norm = this.normalizeTextForMatch(text);
    if (norm.length < 6) return null;
    return norm.length > 64 ? norm.slice(0, 64) : norm;
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
