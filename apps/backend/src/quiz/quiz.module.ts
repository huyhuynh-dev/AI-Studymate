import { Module } from '@nestjs/common';
import { QuizService } from './quiz.service.js';
import { QuizManageService } from './quiz-manage.service.js';
import { QuizAttemptService } from './quiz-attempt.service.js';
import { QuizGradingService } from './quiz-grading.service.js';
import { QuizToFlashcardService } from './quiz-to-flashcard.service.js';
import { DeckToQuizService } from './deck-to-quiz.service.js';
import { QuizController } from './quiz.controller.js';
import { RepoModule } from '../repo/repo.module.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
    imports: [RepoModule, AiModule],
    providers: [
        QuizManageService,
        QuizAttemptService,
        QuizGradingService,
        QuizToFlashcardService,
        DeckToQuizService,
        QuizService,
    ],
    controllers: [QuizController],
    exports: [
        QuizManageService,
        QuizAttemptService,
        QuizGradingService,
        QuizToFlashcardService,
        DeckToQuizService,
        QuizService,
    ],
})
export class QuizModule {}
