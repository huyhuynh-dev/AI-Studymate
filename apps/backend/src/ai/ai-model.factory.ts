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

export type ModelProfile = 'FAST' | 'STANDARD' | 'REASONING' | 'VISION';

export type AiTask =
    | 'EMBEDDING'
    | 'VISION_ANALYZE'
    | 'SUMMARIZE'
    | 'BLOCKNOTE_EDITOR'
    | 'CHAT_AGENT'
    | 'AUTO_HEADER'
    | 'QUIZ_AGENT';

type TaskModel = EmbeddingModel | LanguageModel;

@Injectable()
export class AiModelFactory {
    private readonly customProvider: ReturnType<typeof createOpenAICompatible>;
    private readonly models: Record<ModelProfile, LanguageModel>;
    private readonly embeddingModel: EmbeddingModel;

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
        this.customProvider = createOpenAICompatible({
            name: 'providerName',
            apiKey: this.configService.get<string>('PROVIDER_API_KEY'),
            baseURL: this.configService.get<string>('PROVIDER_BASE_URL')
                ?? 'http://localhost:20128/v1',
            includeUsage: true,
            supportsStructuredOutputs: true,
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

        // 4 Model Profiles chuẩn hóa
        this.models = {
            FAST: this.customProvider('groq/openai/gpt-oss-120b'),
            STANDARD: this.customProvider('cx/gpt-6-luna'),
            REASONING: this.customProvider('cx/gpt-6-luna-medium'),
            VISION: this.customProvider('groq/qwen/qwen3.8-27b'),
        };

        this.embeddingModel = ollama.embeddingModel(
            'nomic-embed-text-v2-moe:latest',
        );
    }

    /**
     * Lấy Language Model theo tầng năng lực chuẩn hóa
     */
    getModel(profile: ModelProfile): LanguageModel {
        const model = this.models[profile];
        if (!model) {
            throw new Error(`No model found for profile: ${profile}`);
        }
        return model;
    }

    /**
     * Lấy Embedding Model
     */
    getEmbeddingModel(): EmbeddingModel {
        return this.embeddingModel;
    }

    /**
     * Lấy Language Model tùy biến theo tên (cho dynamic model selection)
     */
    getCustomModel(modelName: string): LanguageModel {
        return this.customProvider(modelName);
    }

    /**
     * Backward-compatible alias cho Chat Agent
     */
    getChatAgentModel(modelName: string): LanguageModel {
        return this.getCustomModel(modelName);
    }

    /**
     * Backward-compatible method cho các caller cũ dùng AiTask
     */
    getModelForTask(task: 'EMBEDDING'): EmbeddingModel;
    getModelForTask(task: Exclude<AiTask, 'EMBEDDING'>): LanguageModel;
    getModelForTask(task: AiTask): TaskModel {
        if (task === 'EMBEDDING') {
            return this.embeddingModel;
        }

        const taskToProfileMap: Record<Exclude<AiTask, 'EMBEDDING'>, ModelProfile> = {
            VISION_ANALYZE: 'VISION',
            SUMMARIZE: 'STANDARD',
            BLOCKNOTE_EDITOR: 'STANDARD',
            CHAT_AGENT: 'REASONING',
            AUTO_HEADER: 'FAST',
            QUIZ_AGENT: 'STANDARD',
        };

        const profile = taskToProfileMap[task];
        return this.getModel(profile);
    }
}
