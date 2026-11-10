import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { NoObjectGeneratedError } from 'ai';
import { AiService } from './ai.service.js';
import {
  type AICardType,
  type BudgetDoc,
  DomainCardSchema,
  FLASHCARD_AI_LIMITS,
  type FlashcardInsertRow,
  type GenerateFlashcardsRequest,
  type LlmFlashcardOutput,
  LlmMoreCardsOutputSchema,
  LlmNewDeckOutputSchema,
  dedupeKey,
  fitToBudget,
  normalizeCard,
  stripToPlain,
  toFlashcardRows,
} from './schemas/flashcard-ai.schema.js';
import {
  buildFlashcardSystemPrompt,
  buildFlashcardUserPrompt,
} from './prompts/templates/flashcard.prompt.js';

export { buildFlashcardSystemPrompt, buildFlashcardUserPrompt };

export const MAX_CONTEXT_CHARS = 200_000;
export const MAX_EXISTING_FOR_DEDUPE = 300;
const LLM_ATTEMPTS = 2;

export interface GenerateFlashcardsAiInput {
  req: GenerateFlashcardsRequest;
  documents: BudgetDoc[];
  existingDeck?: {
    id: string;
    name: string;
    existingFrontTexts: string[];
  } | null;
}

export interface PreparedFlashcardPromptContext {
  req: GenerateFlashcardsRequest;
  isNewDeck: boolean;
  deckName?: string;
  docs: Array<BudgetDoc & { truncated: boolean }>;
  existingFronts: string[];
  system: string;
  prompt: string;
  existingDedupeKeys: Set<string>;
  docCount: number;
  truncatedDocs: number;
}

export interface GenerateFlashcardsAiResult {
  deckMeta: {
    name: string;
    description: string | null;
  } | null;
  rows: FlashcardInsertRow[];
  dropped: string[];
  docCount: number;
  truncatedDocs: number;
}

@Injectable()
export class FlashcardAiService {
  private readonly logger = new Logger(FlashcardAiService.name);

  constructor(private readonly aiService: AiService) {}

  /**
   * Pipeline AI cho Deck & Flashcard:
   * 1. Chuẩn bị dữ liệu ngữ cảnh (cắt ngân sách water-filling, tạo prompt, lấy khóa khử trùng)
   * 2. Gọi model FLASHCARD_GENERATE qua AiService
   * 3. Chuẩn hóa, kiểm định nghiệp vụ từng thẻ, khử trùng lặp và chuyển đổi sang HTML TipTap
   */
  async generateFlashcards(
    input: GenerateFlashcardsAiInput,
  ): Promise<GenerateFlashcardsAiResult> {
    const startTime = Date.now();
    const ctx = this.prepareContext(input);

    this.logger.log(
      `[generateFlashcards] Bắt đầu gọi model FLASHCARD_GENERATE | target=${input.req.target.kind}, docs=${ctx.docCount} (truncated=${ctx.truncatedDocs}), count=${input.req.count}, types=[${input.req.types.join(', ')}]`,
    );

    const rawOutput = await this.callLlm(ctx);
    const processed = this.processOutput(ctx, rawOutput);

    const duration = Date.now() - startTime;
    this.logger.log(
      `[generateFlashcards] Hoàn tất xử lý AI sau ${duration}ms | Hợp lệ: ${processed.rows.length}/${input.req.count}, Bị loại: ${processed.dropped.length}`,
    );

    if (processed.dropped.length > 0) {
      this.logger.warn(
        `[generateFlashcards] Chi tiết các thẻ bị loại (${processed.dropped.length}): ${JSON.stringify(processed.dropped)}`,
      );
    }

    return processed;
  }

  /* ==========================================================================
   * BƯỚC 1: CHUẨN BỊ NGỮ CẢNH & PROMPT
   * ========================================================================== */

  prepareContext(
    input: GenerateFlashcardsAiInput,
  ): PreparedFlashcardPromptContext {
    const usableDocs = input.documents.filter(
      (d) => d.text.trim().length > 0,
    );
    if (usableDocs.length === 0) {
      throw new UnprocessableEntityException(
        'Các tài liệu đã chọn không có nội dung văn bản để tạo thẻ.',
      );
    }

    const budgetedDocs = fitToBudget(usableDocs, MAX_CONTEXT_CHARS);
    const rawExistingFronts = (
      input.existingDeck?.existingFrontTexts ?? []
    ).slice(0, MAX_EXISTING_FOR_DEDUPE);

    const existingForPrompt = rawExistingFronts
      .map((text) => stripToPlain(text).slice(0, 160))
      .filter(Boolean);

    const existingDedupeKeys = new Set<string>(
      rawExistingFronts.map((text) => dedupeKey(text)).filter(Boolean),
    );

    const isNewDeck = input.req.target.kind === 'new';
    const deckName = input.existingDeck?.name;

    return {
      req: input.req,
      isNewDeck,
      deckName,
      docs: budgetedDocs,
      existingFronts: existingForPrompt,
      system: buildFlashcardSystemPrompt(),
      prompt: buildFlashcardUserPrompt(
        input.req,
        budgetedDocs,
        existingForPrompt,
        deckName,
      ),
      existingDedupeKeys,
      docCount: budgetedDocs.length,
      truncatedDocs: budgetedDocs.filter((d) => d.truncated).length,
    };
  }

  /* ==========================================================================
   * BƯỚC 2: GỌI LLM QUA AISERVICE (FEATURE: FLASHCARD_GENERATE)
   * ========================================================================== */

  private async callLlm(
    ctx: PreparedFlashcardPromptContext,
  ): Promise<LlmFlashcardOutput> {
    const schema = ctx.isNewDeck
      ? LlmNewDeckOutputSchema
      : LlmMoreCardsOutputSchema;

    let lastError: unknown;

    for (let attempt = 1; attempt <= LLM_ATTEMPTS; attempt++) {
      try {
        const { object } =
          await this.aiService.generateObjectForFeature(
            'FLASHCARD_GENERATE',
            {
              req: ctx.req,
              docs: ctx.docs,
              existingFronts: ctx.existingFronts,
              deckName: ctx.deckName,
            },
          );

        return schema.parse(object);
      } catch (err) {
        if (
          NoObjectGeneratedError.isInstance(err) ||
          (err instanceof Error && err.name === 'ZodError')
        ) {
          const reason = NoObjectGeneratedError.isInstance(err)
            ? err.finishReason
            : 'zod_validation_failed';
          this.logger.warn(
            `[callLlm] LLM output không hợp lệ (lần ${attempt}/${LLM_ATTEMPTS}): reason=${reason}`,
          );
          lastError = err;
          continue;
        }

        this.logger.error(
          `[callLlm] Gọi LLM thất bại: ${(err as Error).message}`,
        );
        throw new ServiceUnavailableException(
          'Dịch vụ AI tạm thời không phản hồi. Vui lòng thử lại.',
        );
      }
    }

    this.logger.error(
      `[callLlm] LLM trả dữ liệu sai định dạng sau ${LLM_ATTEMPTS} lần: ${(lastError as Error)?.message}`,
    );
    throw new UnprocessableEntityException(
      'AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.',
    );
  }

  /* ==========================================================================
   * BƯỚC 3: CHUẨN HÓA, KIỂM ĐỊNH NGHIỆP VỤ, KHỬ TRÙNG & CHUYỂN SANG HTML
   * ========================================================================== */

  processOutput(
    ctx: PreparedFlashcardPromptContext,
    out: LlmFlashcardOutput,
  ): GenerateFlashcardsAiResult {
    const { req } = ctx;
    const allowed = new Set<AICardType>(req.types);
    const dropped: string[] = [];
    const seenInBatch = new Set<string>();
    const rows: FlashcardInsertRow[] = [];

    out.cards.forEach((raw, i) => {
      if (rows.length >= req.count) {
        dropped.push(`#${i}: vượt số lượng yêu cầu`);
        return;
      }

      if (!allowed.has(raw.card_type)) {
        dropped.push(
          `#${i}: loại thẻ "${raw.card_type}" không được yêu cầu`,
        );
        return;
      }

      const normalized = normalizeCard(raw);
      const validation = DomainCardSchema.safeParse(normalized);
      if (!validation.success) {
        const reason = validation.error.issues
          .map((issue) => issue.message)
          .join('; ');
        dropped.push(`#${i}: ${reason}`);
        return;
      }

      const key = dedupeKey(normalized.front_text);
      if (!key) {
        dropped.push(`#${i}: nội dung mặt trước rỗng sau chuẩn hóa`);
        return;
      }

      if (ctx.existingDedupeKeys.has(key)) {
        dropped.push(`#${i}: trùng với thẻ đã có trong bộ thẻ`);
        return;
      }

      if (seenInBatch.has(key)) {
        dropped.push(`#${i}: trùng trong lô`);
        return;
      }

      seenInBatch.add(key);
      rows.push(...toFlashcardRows(normalized));
    });

    if (rows.length === 0) {
      throw new UnprocessableEntityException(
        'AI không tạo được thẻ hợp lệ nào. Hãy thử lại hoặc đổi yêu cầu.',
      );
    }

    const deckMeta =
      'deck' in out
        ? {
            name: (req.deckName || out.deck.name || 'Bộ thẻ AI')
              .trim()
              .slice(0, FLASHCARD_AI_LIMITS.deckName),
            description: out.deck.description.trim() || null,
          }
        : null;

    return {
      deckMeta,
      rows,
      dropped,
      docCount: ctx.docCount,
      truncatedDocs: ctx.truncatedDocs,
    };
  }
}
