import { z } from 'zod';

export const visionChunkTypeSchema = z.enum([
  'text',
  'table',
  'code',
  'formula',
  'image_desc',
  'mixed',
]);

export const visionDocumentChunkSchema = z.object({
  content: z
    .string()
    .min(1)
    .describe(
      'Contextualized chunk text starting with hierarchical section headings (e.g., "# Topic > ## Subtopic\\n...") followed by the chunk body, optimized for vector embedding and keyword search.',
    ),
  raw_content: z
    .string()
    .min(1)
    .describe(
      'Clean chunk body without prepended parent headings, suitable for UI citation display.',
    ),
  headings: z
    .array(z.string())
    .describe('Hierarchical headings path leading to this chunk.'),
  chunk_type: visionChunkTypeSchema.describe(
    'Primary content type of this chunk.',
  ),
  has_table: z
    .boolean()
    .describe('True if this chunk contains a Markdown table.'),
  has_image: z
    .boolean()
    .describe(
      'True if this chunk includes visual description of a diagram, chart, or illustration.',
    ),
});

export const visionIngestionSchema = z.object({
  image_category: z
    .enum([
      'document_photo',
      'diagram_chart',
      'code_screenshot',
      'natural_image',
      'mixed',
    ])
    .describe('Classification of the uploaded image.'),
  title_or_topic: z
    .string()
    .min(1)
    .describe(
      'Concise title or main academic topic of the image in Vietnamese.',
    ),
  extracted_markdown: z
    .string()
    .describe(
      'Verbatim transcription of all visible text, Markdown tables (| Col | Col |), LaTeX formulas ($$...$$), and fenced code blocks. Empty string if the image contains no text.',
    ),
  visual_description: z
    .string()
    .describe(
      'Detailed description IN VIETNAMESE of visual elements, charts, diagrams, mindmaps, spatial relationships, or illustrations. Empty string if purely plain text.',
    ),
  contains_table: z.boolean(),
  contains_formula_or_code: z.boolean(),
  chunks: z
    .array(visionDocumentChunkSchema)
    .min(1)
    .describe(
      'Semantic chunks (~300-500 tokens each) covering both extracted_markdown and visual_description without losing any information.',
    ),
});

export type VisionChunkType = z.infer<typeof visionChunkTypeSchema>;
export type VisionDocumentChunk = z.infer<typeof visionDocumentChunkSchema>;
export type VisionIngestionOutput = z.infer<typeof visionIngestionSchema>;
