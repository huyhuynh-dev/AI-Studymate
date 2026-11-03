// ai-model.factory.ts

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOllama } from 'ollama-ai-provider-v2';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import type {
    EmbeddingModel,
    LanguageModel,
} from 'ai';

export type AiTask =
    | 'EMBEDDING'
    | 'VISION_ANALYZE'
    | 'SUMMARIZE'
    | 'BLOCKNOTE_EDITOR'
    | 'CHAT_AGENT'
    | 'AUTO_HEADER';

type TaskModel = EmbeddingModel | LanguageModel;

@Injectable()
export class AiModelFactory {
    private readonly taskModels: Record<AiTask, TaskModel>;

    constructor(
        private readonly configService: ConfigService,
    ) {
        // Google Provider
        const googleApiKey = this.configService.get<string>('GEMINI_API_KEY');

        if (!googleApiKey) {
            throw new Error('Missing Google Generative AI API Key');
        }

        const google = createGoogleGenerativeAI({
            apiKey: googleApiKey,
        });

        // OpenAI Compatible Provider
        const provider = createOpenAICompatible({
            name: 'providerName',
            apiKey: this.configService.get<string>('PROVIDER_API_KEY'),
            baseURL: this.configService.get<string>('PROVIDER_BASE_URL')
                ?? 'http://localhost:20128/v1',
            includeUsage: true,
        });

        // Ollama Provider
        const ollamaServerUrl =
            this.configService.get<string>('OLLAMA_SERVER_URL')
            ?? 'http://localhost:11434';

        const ollama = createOllama({
            baseURL: ollamaServerUrl.endsWith('/api')
                ? ollamaServerUrl
                : `${ollamaServerUrl}/api`,
        });

        // Task Models Registry
        this.taskModels = {
            EMBEDDING: ollama.embeddingModel(
                'nomic-embed-text-v2-moe:latest',
            ),

            VISION_ANALYZE: google('gemini-3.5-flash-lite'),

            SUMMARIZE: provider('cx/gpt-6-luna'),

            BLOCKNOTE_EDITOR: provider('cx/gpt-6-luna'),

            CHAT_AGENT: provider('cx/gpt-6-luna'),

            AUTO_HEADER: ollama('qwen3.5:0.8b'),
        };
    }

    getModelForTask(task: 'EMBEDDING'): EmbeddingModel;

    getModelForTask(
        task: Exclude<AiTask, 'EMBEDDING'>,
    ): LanguageModel;

    getModelForTask(task: AiTask): TaskModel {
        const model = this.taskModels[task];

        if (!model) {
            throw new Error(`No model found for task: ${task}`);
        }

        return model;
    }
}