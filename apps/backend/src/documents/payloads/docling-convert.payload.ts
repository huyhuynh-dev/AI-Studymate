export interface DoclingVlmApiConfig {
  url: string;
  apiKey: string;
  model: string;
  timeoutSec?: number;
  prompt?: string;
}

export interface BuildDoclingConvertPayloadParams {
  fileName: string;
  base64String: string;
  ocrLang?: string[];
  vlmApi?: DoclingVlmApiConfig | null;
  doChartExtraction?: boolean;
}

export const DEFAULT_DOCLING_VLM_PROMPT =
  'You are an academic visual analyzer. Describe this image, chart, diagram, or figure in detail IN VIETNAMESE. Clearly explain all labels, data trends, axes, mathematical relationships, or workflows shown. If there is text or formulas inside the image, transcribe and contextualize them. Output strictly in Vietnamese without introductory filler phrases.';

export const SUPPORTED_DOCLING_CONVERT_FORMATS = [
  'pdf',
  'docx',
  'doc',
  'rtf',
  'pptx',
  'ppt',
  'xlsx',
  'xls',
  'csv',
  'md',
  'asciidoc',
  'html',
  'mhtml',
  'odt',
  'ods',
  'odp',
  'epub',
  'latex',
] as const;

/**
 * Tạo JSON Payload chuẩn gửi tới POST /v1/convert/source/async của Docling Server.
 * Đã loại bỏ các giá trị giả định của Swagger, bật đầy đủ OCR, Table, Heading Hierarchy,
 * Code/Formula Enrichment và inject động picture_description_api cho Tiếng Việt.
 */
export function buildDoclingConvertPayload(
  params: BuildDoclingConvertPayloadParams,
): Record<string, unknown> {
  const hasVlmApi = Boolean(
    params.vlmApi?.url?.trim() && params.vlmApi?.apiKey?.trim(),
  );

  const options: Record<string, unknown> = {
    from_formats: [...SUPPORTED_DOCLING_CONVERT_FORMATS],
    to_formats: ['md', 'json'],
    image_export_mode: 'embedded',
    do_ocr: true,
    force_ocr: false,
    ocr_lang: params.ocrLang ?? ['vi', 'en'],
    pdf_backend: 'dlparse_v4',
    do_table_structure: true,
    table_mode: 'accurate',
    table_cell_matching: true,
    abort_on_error: false,
    do_pdf_heading_hierarchy: true,
    pdf_heading_hierarchy_options: {
      enabled: true,
      use_bookmarks: true,
      use_numbering: true,
      use_style: true,
      use_font_style: true,
      style_size_tolerance: 0.05,
      max_level: 6,
      bookmark_match_threshold: 0.8,
    },
    include_images: true,
    include_page_images: false,
    images_scale: 2.0,
    md_page_break_placeholder: '<!-- page-break -->',
    md_compact_tables: true,
    table_structure_preset: 'tableformer_v1_accurate',
    do_code_enrichment: true,
    do_formula_enrichment: true,
    code_formula_preset: 'codeformulav2',
    do_picture_classification: true,
    picture_classification_preset: 'document_figure_classifier_v2',
    do_chart_extraction: params.doChartExtraction ?? false,
    do_picture_description: hasVlmApi,
    picture_description_area_threshold: 0.05,
  };

  if (hasVlmApi && params.vlmApi) {
    options.picture_description_api = {
      url: params.vlmApi.url.trim(),
      headers: {
        Authorization: `Bearer ${params.vlmApi.apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      params: {
        model: params.vlmApi.model.trim() || 'gpt-4.1-mini',
        temperature: 0.2,
        max_tokens: 1024,
        stream: false,
      },
      timeout: params.vlmApi.timeoutSec ?? 60,
      concurrency: 2,
      prompt: params.vlmApi.prompt ?? DEFAULT_DOCLING_VLM_PROMPT,
    };
  }

  return {
    options,
    sources: [
      {
        kind: 'file',
        filename: params.fileName,
        base64_string: params.base64String,
      },
    ],
    target: {
      kind: 'inbody',
    },
    callbacks: [],
  };
}
