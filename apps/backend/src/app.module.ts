import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RequestUserContextInterceptor } from './common/context/request-user-context.interceptor.js';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { RepoModule } from './repo/repo.module.js';
import { MailModule } from './mail/mail.module.js';
import { RedisModule } from './redis/redis.module.js';
import { ThrottlerModule } from '@nestjs/throttler';
import { SubjectsModule } from './subjects/subjects.module.js';
import { ConversationsModule } from './conversations/conversations.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { StorageModule } from './storage/storage.module.js';
import { AiModule } from './ai/ai.module.js';
import { SummariesModule } from './summaries/summaries.module.js';
import { ChatAgentModule } from './chat-agent/chat-agent.module.js';
import { DeckFlashcardModule } from './deck-flashcard/deck-flashcard.module.js';
import { QuizModule } from './quiz/quiz.module.js';
import { SearchModule } from './search/search.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { RagBenchmarkModule } from './rag-benchmark/rag-benchmark.module.js';
import { AdminModule } from './admin/admin.module.js';
import { TtsModule } from './tts/tts.module.js';


export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'backend',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    UsersModule,
    RepoModule,
    MailModule,
    RedisModule,
    SubjectsModule,
    ConversationsModule,
    DocumentsModule,
    StorageModule,
    AiModule,
    SummariesModule,
    ChatAgentModule,
    DeckFlashcardModule,
    QuizModule,
    SearchModule,
    AnalyticsModule,
    RagBenchmarkModule,
    AdminModule,
    TtsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestUserContextInterceptor,
    },
  ],
})
export class AppModule { }
