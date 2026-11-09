import { Module } from '@nestjs/common';
import { QuizService } from './quiz.service.js';
import { QuizController } from './quiz.controller.js';

@Module({
  providers: [QuizService],
  controllers: [QuizController]
})
export class QuizModule {}
