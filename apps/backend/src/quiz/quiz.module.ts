import { Module } from '@nestjs/common';
import { QuizService } from './quiz.service.js';
import { QuizController } from './quiz.controller.js';
import { RepoModule } from '../repo/repo.module.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
    imports: [RepoModule, AiModule],
    providers: [QuizService],
    controllers: [QuizController],
    exports: [QuizService],
})
export class QuizModule {}
