export type DoclingChunkSourceMode = 'json_docling' | 'markdown' | 'file';

export interface BuildDoclingHybridChunkPayloadParams {
  fileName: string;
  base64String: string;
  mode: DoclingChunkSourceMode;
  tokenizer?: string;
  maxTokens?: number;
}

export const DEFAULT_VIETNAMESE_TOKENIZER = 'intfloat/multilingual-e5-base';
export const DEFAULT_CHUNK_MAX_TOKENS = 512;

/**
 * Tạo JSON Payload chuẩn gửi tới POST /v1/chunk/hybrid/source/async của Docling Server.
 * - Khi mode === 'json_docling' (Cách 3A): Nạp thẳng cây DOM json_content từ bước Convert,
 *   tắt toàn bộ cờ OCR/Table/VLM để tránh chạy lại mô hình lần 2 mà vẫn giữ 100% metadata.
 * - Khi mode === 'markdown': Băm trực tiếp tệp .md / .txt với HybridChunker.
 */
export function buildDoclingHybridChunkPayload(
  params: BuildDoclingHybridChunkPayloadParams,
): Record<string, unknown> {
  const tokenizer = params.tokenizer?.trim() || DEFAULT_VIETNAMESE_TOKENIZER;
  const maxTokens =
    typeof params.maxTokens === 'number' && params.maxTokens > 0
      ? params.maxTokens
      : DEFAULT_CHUNK_MAX_TOKENS;

  const chunkingOptions = {
    chunker: 'hybrid',
    use_markdown_tables: true,
    use_markdown_images: true,
    image_placeholder: '![IMAGE]',
    include_raw_text: true,
    max_tokens: maxTokens,
    tokenizer,
    merge_peers: true,
  };

  const isLightweightInput =
    params.mode === 'json_docling' || params.mode === 'markdown';

  const fromFormats =
    params.mode === 'json_docling'
      ? ['json_docling']
      : params.mode === 'markdown'
        ? ['md']
        : undefined;

  const convertOptions: Record<string, unknown> = {
    ...(fromFormats ? { from_formats: fromFormats } : {}),
    to_formats: ['md'],
    image_export_mode: 'placeholder',
    do_ocr: !isLightweightInput,
    force_ocr: false,
    do_table_structure: params.mode !== 'json_docling',
    table_mode: 'accurate',
    table_cell_matching: true,
    abort_on_error: false,
    include_images: false,
    include_page_images: false,
    md_compact_tables: true,
    do_code_enrichment: false,
    do_formula_enrichment: false,
    do_picture_classification: false,
    do_picture_description: false,
    do_chart_extraction: false,
    chunking_options: chunkingOptions,
  };

  return {
    convert_options: convertOptions,
    sources: [
      {
        kind: 'file',
        filename: params.fileName,
        base64_string: params.base64String,
      },
    ],
    include_converted_doc: false,
    target: {
      kind: 'inbody',
    },
    callbacks: [],
    chunking_options: chunkingOptions,
  };
}
