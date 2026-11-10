import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
    UnprocessableEntityException,
} from '@nestjs/common';
import { CardTypeEnum, Prisma } from '../generated/prisma/client.js';
import {
    FlashcardAiService,
    MAX_EXISTING_FOR_DEDUPE,
} from '../ai/flashcard-ai.service.js';
import {
    type BudgetDoc,
    type GenerateFlashcardsRequest,
} from '../ai/schemas/flashcard-ai.schema.js';
import { DeckFlashcardRepoService } from '../repo/deck-flashcard-repo/deck-flashcard-repo.service.js';
import { DocumentsRepoService } from '../repo/documents-repo/documents-repo.service.js';
import { sanitizeFlashcardHtml } from './flashcard/flashcard.service.js';

export interface GenerateFlashcardsWithAiResponse {
    deckId: string;
    cards: Prisma.FlashcardModel[];
    stats: {
        requested: number;
        saved: number;
        dropped: number;
        truncatedDocuments: number;
    };
}

@Injectable()
export class FlashcardAiManageService {
    private readonly logger = new Logger(FlashcardAiManageService.name);

    constructor(
        private readonly deckRepo: DeckFlashcardRepoService,
        private readonly documentsRepo: DocumentsRepoService,
        private readonly flashcardAiService: FlashcardAiService
    ) {}

    /**
     * Điều phối luồng "Tạo Flashcard bằng AI":
     * 1. Xác thực quyền sở hữu Conversation & Deck, nạp nội dung tài liệu và thẻ hiện có
     * 2. Ủy nhiệm cho FlashcardAiService gọi LLM (QUIZ_AGENT) và kiểm định chất lượng
     * 3. Làm sạch HTML (defense-in-depth) và lưu nguyên tử vào CSDL
     */
    async generateWithAi(
        userId: string,
        req: GenerateFlashcardsRequest
    ): Promise<GenerateFlashcardsWithAiResponse> {
        const startTime = Date.now();

        // 1. Kiểm tra phiên học thuộc người dùng
        const hasConv = await this.deckRepo.verifyConversationOwnership(
            req.conversationId,
            userId
        );
        if (!hasConv) {
            throw new NotFoundException(
                'Không tìm thấy phiên học hoặc bạn không có quyền truy cập.'
            );
        }

        // 2. Nếu thêm vào Deck có sẵn: kiểm tra quyền sở hữu Deck & lấy thẻ hiện có để khử trùng
        let existingDeck: {
            id: string;
            name: string;
            existingFrontTexts: string[];
        } | null = null;

        if (req.target.kind === 'deck') {
            const deck = await this.deckRepo.getDeckInConversation(
                req.target.deckId,
                req.conversationId,
                userId
            );
            if (!deck) {
                throw new NotFoundException(
                    'Không tìm thấy bộ thẻ hoặc bạn không có quyền truy cập.'
                );
            }

            const existingFrontTexts =
                await this.deckRepo.getRecentFlashcardFronts(
                    deck.id,
                    MAX_EXISTING_FOR_DEDUPE
                );

            existingDeck = {
                id: deck.id,
                name: deck.name,
                existingFrontTexts,
            };
        }

        // 3. Nạp và kiểm tra tài liệu thuộc phiên học & người dùng
        const documents = await this.loadConversationDocuments(
            userId,
            req.conversationId,
            req.documentIds
        );

        // 4. Gọi FlashcardAiService để chuẩn bị prompt, gọi LLM và xử lý kết quả
        const aiResult = await this.flashcardAiService.generateFlashcards({
            req,
            documents,
            existingDeck,
        });

        // 5. Sanitize HTML một lần nữa (defense-in-depth) và chuẩn bị dòng lưu DB
        const dbRows = aiResult.rows.map((row) => ({
            card_type: row.card_type as CardTypeEnum,
            front_text: sanitizeFlashcardHtml(
                row.front_text,
                row.card_type === 'cloze'
            ),
            back_text: sanitizeFlashcardHtml(row.back_text, false),
        }));

        // 6. Lưu nguyên tử vào CSDL
        const saved = await this.saveToDatabase(
            userId,
            req,
            existingDeck?.id ?? null,
            aiResult.deckMeta,
            dbRows
        );

        const totalMs = Date.now() - startTime;
        this.logger.log(
            `[generateWithAi] Hoàn tất trong ${totalMs}ms | user=${userId} target=${req.target.kind} deckId=${saved.deckId} docs=${aiResult.docCount} requested=${req.count} saved=${saved.cards.length} dropped=${aiResult.dropped.length}`
        );

        return {
            deckId: saved.deckId,
            cards: saved.cards,
            stats: {
                requested: req.count,
                saved: saved.cards.length,
                dropped: aiResult.dropped.length,
                truncatedDocuments: aiResult.truncatedDocs,
            },
        };
    }

    /**
     * Nạp nội dung văn bản của các tài liệu thuộc đúng conversationId và userId.
     * Chặn và báo lỗi nếu client gửi documentIds lạ không thuộc phiên học.
     */
    private async loadConversationDocuments(
        userId: string,
        conversationId: string,
        documentIds: string[] | 'all'
    ): Promise<BudgetDoc[]> {
        const allDocs =
            await this.documentsRepo.getAllDocumentsByConversationId(
                conversationId,
                userId
            );

        let selectedDocs = allDocs;

        if (documentIds !== 'all') {
            const docMap = new Map(allDocs.map((d) => [d.id, d]));
            const unknownIds = documentIds.filter((id) => !docMap.has(id));

            if (unknownIds.length > 0) {
                throw new BadRequestException(
                    'Một hoặc nhiều tài liệu được chọn không thuộc phiên học này hoặc bạn không có quyền truy cập.'
                );
            }

            const uniqueSelectedIds = [...new Set(documentIds)];
            selectedDocs = uniqueSelectedIds
                .map((id) => docMap.get(id)!)
                .filter(Boolean);
        }

        const usableDocs: BudgetDoc[] = selectedDocs
            .filter(
                (d) =>
                    d.ocr_status === 'done' &&
                    typeof d.raw_text === 'string' &&
                    d.raw_text.trim().length > 0
            )
            .map((d) => ({
                id: d.id,
                name: d.file_name || d.id,
                text: d.raw_text!.trim(),
            }));

        if (usableDocs.length === 0) {
            throw new UnprocessableEntityException(
                'Các tài liệu đã chọn chưa xử lý xong hoặc không có nội dung văn bản để tạo thẻ.'
            );
        }

        return usableDocs;
    }

    /**
     * Lưu kết quả vào CSDL một cách nguyên tử:
     * - Tạo Deck mới: nested create (Deck + Flashcards trong 1 câu lệnh)
     * - Thêm vào Deck có sẵn: $transaction (createManyAndReturn + update updated_at)
     */
    private async saveToDatabase(
        userId: string,
        req: GenerateFlashcardsRequest,
        existingDeckId: string | null,
        deckMeta: { name: string; description: string | null } | null,
        rows: Array<{
            card_type: CardTypeEnum;
            front_text: string;
            back_text: string;
        }>
    ): Promise<{ deckId: string; cards: Prisma.FlashcardModel[] }> {
        if (rows.length === 0) {
            throw new UnprocessableEntityException(
                'AI không tạo được thẻ hợp lệ nào. Hãy thử lại hoặc đổi yêu cầu.'
            );
        }

        if (!existingDeckId) {
            return await this.deckRepo.createDeckWithFlashcards({
                conversationId: req.conversationId,
                userId,
                name: deckMeta?.name ?? 'Bộ thẻ AI',
                description: deckMeta?.description ?? null,
                rows,
            });
        }

        const cards = await this.deckRepo.addFlashcardsToDeckAtomic(
            existingDeckId,
            rows
        );
        return {
            deckId: existingDeckId,
            cards,
        };
    }
}
