import type { z } from 'zod';
import type { PromptPayloadMap } from '../prompts/types.js';
import { summaryOutputSchema, type SummaryOutput } from './blocknote.schema.js';
import {
  buildQuizSchema,
  essayGradingSchema,
  type EssayGradingOutput,
  type GeneratedQuiz,
} from './quiz-ai.schema.js';
import {
  LlmMoreCardsOutputSchema,
  LlmNewDeckOutputSchema,
  type LlmFlashcardOutput,
} from './flashcard-ai.schema.js';
import {
  followUpSuggestionsSchema,
  type FollowUpSuggestionsOutput,
} from './chat-agent.schema.js';
import {
  visionIngestionSchema,
  type VisionIngestionOutput,
} from './vision-ingestion.schema.js';

export * from './blocknote.schema.js';
export * from './quiz-ai.schema.js';
export * from './flashcard-ai.schema.js';
export * from './chat-agent.schema.js';
export * from './vision-ingestion.schema.js';

export interface FeatureOutputMap {
  SUMMARIZE_GENERATE: SummaryOutput;
  SUMMARIZE_REFINE: SummaryOutput;
  QUIZ_GENERATE: GeneratedQuiz;
  ESSAY_GRADE: EssayGradingOutput;
  FLASHCARD_GENERATE: LlmFlashcardOutput;
  FOLLOW_UP_SUGGESTIONS: FollowUpSuggestionsOutput;
  VISION_OCR: VisionIngestionOutput;
}

export type StructuredFeatureKey = keyof FeatureOutputMap;

export interface ResolvedSchemaConfig<TOutput = unknown> {
  schema: z.ZodType<TOutput>;
  schemaName?: string;
  schemaDescription?: string;
}

type SchemaEntry<K extends StructuredFeatureKey> =
  | ResolvedSchemaConfig<FeatureOutputMap[K]>
  | ((payload: PromptPayloadMap[K]) => ResolvedSchemaConfig<FeatureOutputMap[K]>);

export const FEATURE_SCHEMAS: {
  [K in StructuredFeatureKey]: SchemaEntry<K>;
} = {
  SUMMARIZE_GENERATE: {
    schema: summaryOutputSchema,
    schemaName: 'SummaryGeneration',
    schemaDescription: 'Bản tóm tắt học tập theo cấu trúc BlockNote',
  },
  SUMMARIZE_REFINE: {
    schema: summaryOutputSchema,
    schemaName: 'SummaryRefinement',
    schemaDescription: 'Bản tóm tắt học tập đã tinh chỉnh theo cấu trúc BlockNote',
  },
  QUIZ_GENERATE: (payload) => ({
    schema: buildQuizSchema(payload.types) as z.ZodType<GeneratedQuiz>,
    schemaName: 'QuizGeneration',
    schemaDescription: 'Đề kiểm tra và danh sách câu hỏi sinh từ tài liệu học tập',
  }),
  ESSAY_GRADE: {
    schema: essayGradingSchema,
    schemaName: 'EssayGrading',
    schemaDescription: 'Kết quả chấm điểm và nhận xét câu trả lời tự luận',
  },
  FLASHCARD_GENERATE: (payload) => ({
    schema: (payload.req.target.kind === 'new'
      ? LlmNewDeckOutputSchema
      : LlmMoreCardsOutputSchema) as z.ZodType<LlmFlashcardOutput>,
    schemaName:
      payload.req.target.kind === 'new'
        ? 'FlashcardNewDeckGeneration'
        : 'FlashcardMoreCardsGeneration',
    schemaDescription: 'Bộ thẻ ghi nhớ (Flashcards) sinh từ tài liệu học tập',
  }),
  FOLLOW_UP_SUGGESTIONS: {
    schema: followUpSuggestionsSchema,
    schemaName: 'FollowUpSuggestions',
    schemaDescription: 'Danh sách câu hỏi gợi ý tiếp nối cuộc trò chuyện',
  },
  VISION_OCR: {
    schema: visionIngestionSchema,
    schemaName: 'VisionDocumentIngestion',
    schemaDescription:
      'Kết quả trích xuất OCR, mô tả hình ảnh và phân đoạn ngữ nghĩa (chunking) từ hình ảnh học tập',
  },
};

export function resolveFeatureSchema<K extends StructuredFeatureKey>(
  feature: K,
  payload: PromptPayloadMap[K],
): ResolvedSchemaConfig<FeatureOutputMap[K]> {
  const entry = FEATURE_SCHEMAS[feature];
  if (!entry) {
    throw new Error(`No schema configured for structured feature: ${feature}`);
  }
  return typeof entry === 'function' ? entry(payload) : entry;
}
