// ai-model.factory.ts

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { createCohere } from '@ai-sdk/cohere';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import type {
    EmbeddingModel,
    LanguageModel,
    RerankingModel,
} from 'ai';

export type LanguageModelProfile = 'FAST' | 'STANDARD' | 'REASONING' | 'VISION';
export type ModelProfile = LanguageModelProfile | 'RERANK';

export type AiTask =
    | 'EMBEDDING'
    | 'RERANK'
    | 'VISION_ANALYZE'
    | 'SUMMARIZE'
    | 'BLOCKNOTE_EDITOR'
    | 'CHAT_AGENT'
    | 'AUTO_HEADER'
    | 'QUIZ_AGENT';

type TaskModel =
    | Exclude<EmbeddingModel, string>
    | LanguageModel
    | Exclude<RerankingModel, string>;

/**
 * Chuẩn hóa response JSON từ llama-server /v1/rerank sang định dạng @ai-sdk/cohere
 * (bổ sung trường `meta` nếu server local không trả về để pass Zod schema của Cohere).
 */
function createLocalCohereRerankFetch(): typeof fetch {
    return async (input, init) => {
        const response = await globalThis.fetch(input, init);
        if (!response.ok) {
            return response;
        }

        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
            return response;
        }

        const rawText = await response.text();
        try {
            const parsed = JSON.parse(rawText) as Record<string, unknown>;
            if (parsed && typeof parsed === 'object' && !('meta' in parsed)) {
                parsed.meta = null;
                return new Response(JSON.stringify(parsed), {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                });
            }
        } catch {
            // Giữ nguyên response gốc nếu parse JSON thất bại để SDK tự báo lỗi chuẩn
        }

        return new Response(rawText, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });
    };
}

@Injectable()
export class AiModelFactory {
    private readonly customProvider: ReturnType<typeof createOpenAICompatible>;
    private readonly models: Record<LanguageModelProfile, LanguageModel>;
    private readonly embeddingModel: EmbeddingModel;
    private readonly rerankingModel: RerankingModel;

    constructor(
        private readonly configService: ConfigService,
    ) {
        // Google Provider
        const googleApiKey = this.configService.get<string>('GEMINI_API_KEY');

        if (!googleApiKey) {
            throw new Error('Missing Google Generative AI API Key');
        }

        const _google = createGoogleGenerativeAI({
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

        // Llama Server Embedding Provider (OpenAI Compatible)
        const llamaEmbeddingUrl =
            this.configService.get<string>('LLAMA_SERVER_URL_EMBEDDING')
            ?? 'http://127.0.0.1:8082';
        const normalizedLlamaEmbeddingUrl = llamaEmbeddingUrl.replace(/\/+$/, '');

        const llamaEmbeddingProvider = createOpenAICompatible({
            name: 'llama-server-embedding',
            baseURL: normalizedLlamaEmbeddingUrl.endsWith('/v1')
                ? normalizedLlamaEmbeddingUrl
                : `${normalizedLlamaEmbeddingUrl}/v1`,
        });

        // 4 Model Profiles chuẩn hóa
        this.models = {
            FAST: this.customProvider('groq/openai/gpt-oss-120b'),
            STANDARD: this.customProvider('cx/gpt-6-luna'),
            REASONING: this.customProvider('cx/gpt-6-luna-medium'),
            VISION: this.customProvider('gemini/gemini-3.5-flash-lite'),
        };

        this.embeddingModel = llamaEmbeddingProvider.embeddingModel(
            'nomic-embed-text-v2-moe',
        );

        // Llama Server Rerank Provider (Cohere Compatible)
        const llamaRerankUrl =
            this.configService.get<string>('LLAMA_SERVER_URL_RERANK')
            ?? 'http://127.0.0.1:8081';
        const normalizedLlamaRerankUrl = llamaRerankUrl.replace(/\/+$/, '');

        const llamaRerankProvider = createCohere({
            apiKey:
                this.configService.get<string>('COHERE_API_KEY')
                || 'local-no-key',
            baseURL: normalizedLlamaRerankUrl.endsWith('/v1')
                ? normalizedLlamaRerankUrl
                : `${normalizedLlamaRerankUrl}/v1`,
            fetch: createLocalCohereRerankFetch(),
        });

        this.rerankingModel = llamaRerankProvider.reranking('bge-reranker-v2-m3');
    }

    /**
     * Lấy Language Model theo tầng năng lực chuẩn hóa
     */
    getModel(profile: ModelProfile): LanguageModel {
        if (profile === 'RERANK') {
            throw new Error(
                'RERANK profile uses a RerankingModel; call getRerankingModel() instead.',
            );
        }
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
     * Lấy Reranking Model (Cross-Encoder bge-reranker-v2-m3)
     */
    getRerankingModel(): RerankingModel {
        return this.rerankingModel;
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
    getModelForTask(task: 'RERANK'): RerankingModel;
    getModelForTask(
        task: Exclude<AiTask, 'EMBEDDING' | 'RERANK'>,
    ): LanguageModel;
    getModelForTask(task: AiTask): TaskModel {
        if (task === 'EMBEDDING') {
            return this.embeddingModel;
        }
        if (task === 'RERANK') {
            return this.rerankingModel;
        }

        const taskToProfileMap: Record<
            Exclude<AiTask, 'EMBEDDING' | 'RERANK'>,
            LanguageModelProfile
        > = {
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
