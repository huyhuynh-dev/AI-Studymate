import { Injectable, Optional } from '@nestjs/common';
import {
  embedMany,
  experimental_transcribe as transcribe,
  generateText,
  streamText,
  rerank,
  Output,
} from 'ai';
import { AiModelFactory } from './ai-model.factory.js';
import type { AiTask } from './ai-model.factory.js';
import { PromptRegistryService } from './prompts/prompt-registry.service.js';
import { FEATURE_MAP } from './configs/feature-mapping.config.js';
import type { FeatureKey, PromptPayloadMap } from './prompts/types.js';
import {
  resolveFeatureSchema,
  type FeatureOutputMap,
  type StructuredFeatureKey,
} from './schemas/index.js';
import {
  AiTelemetryService,
  estimateTokensFromChars,
  extractNormalizedUsage,
  resolveModelName,
  type RawAiUsageLike,
} from './telemetry/ai-telemetry.service.js';

export type RerankDocumentInput = NonNullable<
  Parameters<typeof rerank>[0]['documents']
>[number];

export interface RerankDocumentsParams<
  T extends RerankDocumentInput = string,
> {
  query: string;
  documents: T[];
  topN?: number;
  abortSignal?: AbortSignal;
}

export interface TranscribeAudioParams {
  audio: Parameters<typeof transcribe>[0]['audio'];
  mimeType?: string;
  language?: string;
  abortSignal?: AbortSignal;
}

@Injectable()
export class AiService {
  constructor(
    private readonly aiModelFactory: AiModelFactory,
    private readonly promptRegistry: PromptRegistryService,
    @Optional() private readonly aiTelemetry?: AiTelemetryService,
  ) {}

  getTelemetryService(): AiTelemetryService | undefined {
    return this.aiTelemetry;
  }

  /**
   * Chuẩn bị đầy đủ Model, Config và Prompt đã render cho 1 tính năng
   */
  prepare<T extends FeatureKey>(
    feature: T,
    payload: PromptPayloadMap[T],
    modelNameOverride?: string,
  ) {
    const config = FEATURE_MAP[feature];
    const model = modelNameOverride
      ? this.aiModelFactory.getCustomModel(modelNameOverride)
      : this.aiModelFactory.getModel(config.profile);

    const { system, prompt } = this.promptRegistry.render(feature, payload);

    return {
      model,
      system,
      prompt,
      temperature: config.temperature,
      maxRetries: config.maxRetries,
      providerOptions: config.providerOptions,
    };
  }

  /**
   * Chuẩn bị dữ liệu cho tác vụ sinh Structured Output (Model + Prompt + Schema chuẩn từ registry)
   */
  prepareObject<K extends StructuredFeatureKey>(
    feature: K,
    payload: PromptPayloadMap[K],
    modelNameOverride?: string,
  ) {
    const base = this.prepare(feature, payload, modelNameOverride);
    const schemaConfig = resolveFeatureSchema(feature, payload);

    return {
      ...base,
      schema: schemaConfig.schema,
      schemaName: schemaConfig.schemaName,
      schemaDescription: schemaConfig.schemaDescription,
    };
  }

  /**
   * Sinh cấu trúc dữ liệu (Object Output) theo FeatureKey với Schema tự động từ registry
   */
  async generateObjectForFeature<
    TOutput = never,
    K extends StructuredFeatureKey = StructuredFeatureKey,
  >(
    feature: K,
    payload: PromptPayloadMap[K],
    options?: {
      schema?: unknown;
      schemaName?: string;
      schemaDescription?: string;
      modelName?: string;
      temperature?: number;
      maxRetries?: number;
      abortSignal?: AbortSignal;
      messages?: NonNullable<Parameters<typeof generateText>[0]['messages']>;
    },
  ): Promise<{
    object: [TOutput] extends [never] ? FeatureOutputMap[K] : TOutput;
  }> {
    const preparedObj = this.prepareObject(
      feature,
      payload,
      options?.modelName,
    );

    const targetSchema = (options?.schema ?? preparedObj.schema) as any;
    const targetSchemaName = options?.schemaName ?? preparedObj.schemaName;
    const targetSchemaDesc =
      options?.schemaDescription ?? preparedObj.schemaDescription;

    const startedAt = Date.now();
    const profile = FEATURE_MAP[feature].profile;
    const modelName = options?.modelName ?? resolveModelName(preparedObj.model, profile);

    try {
      const result = await generateText({
        model: preparedObj.model,
        output: Output.object({
          schema: targetSchema,
          ...(targetSchemaName ? { name: targetSchemaName } : {}),
          ...(targetSchemaDesc ? { description: targetSchemaDesc } : {}),
        }),
        ...(options?.messages
          ? { messages: options.messages }
          : { prompt: preparedObj.prompt }),
        system: preparedObj.system,
        temperature: options?.temperature ?? preparedObj.temperature,
        maxRetries: options?.maxRetries ?? preparedObj.maxRetries,
        ...(options?.abortSignal ? { abortSignal: options.abortSignal } : {}),
      });

      const usage = extractNormalizedUsage(
        result.usage as RawAiUsageLike | undefined,
        preparedObj.system.length + preparedObj.prompt.length,
        JSON.stringify(result.output ?? '').length,
      );
      this.aiTelemetry?.recordUsage({
        featureKey: feature,
        profile,
        modelName,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        latencyMs: Date.now() - startedAt,
        status: 'success',
      });

      return {
        object: result.output as [TOutput] extends [never]
          ? FeatureOutputMap[K]
          : TOutput,
      };
    } catch (error: unknown) {
      this.aiTelemetry?.recordUsage({
        featureKey: feature,
        profile,
        modelName,
        promptTokens: estimateTokensFromChars(
          preparedObj.system.length + preparedObj.prompt.length,
        ),
        completionTokens: 0,
        latencyMs: Date.now() - startedAt,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Sinh văn bản theo FeatureKey
   */
  async generateTextForFeature<K extends FeatureKey = FeatureKey>(
    feature: K,
    payload: PromptPayloadMap[K],
    options?: {
      modelName?: string;
      temperature?: number;
    },
  ) {
    const prepared = this.prepare(feature, payload, options?.modelName);
    const startedAt = Date.now();
    const profile = FEATURE_MAP[feature].profile;
    const modelName = options?.modelName ?? resolveModelName(prepared.model, profile);

    try {
      const result = await generateText({
        model: prepared.model,
        prompt: prepared.prompt,
        system: prepared.system,
        temperature: options?.temperature ?? prepared.temperature,
        providerOptions: prepared.providerOptions as any,
      });

      const usage = extractNormalizedUsage(
        result.usage as RawAiUsageLike | undefined,
        prepared.system.length + prepared.prompt.length,
        result.text?.length ?? 0,
      );
      this.aiTelemetry?.recordUsage({
        featureKey: feature,
        profile,
        modelName,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        latencyMs: Date.now() - startedAt,
        status: 'success',
      });

      return result;
    } catch (error: unknown) {
      this.aiTelemetry?.recordUsage({
        featureKey: feature,
        profile,
        modelName,
        promptTokens: estimateTokensFromChars(
          prepared.system.length + prepared.prompt.length,
        ),
        completionTokens: 0,
        latencyMs: Date.now() - startedAt,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async embedMany(values: string[]) {
    const startedAt = Date.now();
    const model = this.aiModelFactory.getEmbeddingModel();
    const modelName = resolveModelName(model, 'nomic-embed-text-v2-moe');
    const totalChars = values.reduce((acc, v) => acc + v.length, 0);

    try {
      const result = await embedMany({
        model,
        values,
        providerOptions: {
          google: {
            outputDimensionality: 768,
          },
        },
      });

      const usage = extractNormalizedUsage(
        result.usage as RawAiUsageLike | undefined,
        totalChars,
        0,
      );
      this.aiTelemetry?.recordUsage({
        featureKey: 'DOCUMENT_EMBEDDING',
        profile: 'EMBEDDING',
        modelName,
        promptTokens: usage.promptTokens,
        completionTokens: 0,
        totalTokens: usage.promptTokens,
        latencyMs: Date.now() - startedAt,
        status: 'success',
      });

      return result;
    } catch (error: unknown) {
      this.aiTelemetry?.recordUsage({
        featureKey: 'DOCUMENT_EMBEDDING',
        profile: 'EMBEDDING',
        modelName,
        promptTokens: estimateTokensFromChars(totalChars),
        completionTokens: 0,
        latencyMs: Date.now() - startedAt,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Tái xếp hạng (Cross-Encoder Reranking) danh sách đoạn văn bản theo độ liên quan với câu truy vấn
   */
  async rerankDocuments<T extends RerankDocumentInput = string>(
    params: RerankDocumentsParams<T>,
  ) {
    const config = FEATURE_MAP.DOCUMENT_RERANK;
    const model = this.aiModelFactory.getRerankingModel();
    const startedAt = Date.now();
    const modelName = resolveModelName(model, 'bge-reranker-v2-m3');
    const estimatedInputChars =
      params.query.length +
      params.documents.reduce(
        (acc, doc) =>
          acc + (typeof doc === 'string' ? doc.length : JSON.stringify(doc).length),
        0,
      );

    try {
      const result = await rerank({
        model,
        query: params.query,
        documents: params.documents,
        ...(params.topN !== undefined ? { topN: params.topN } : {}),
        maxRetries: config.maxRetries ?? 1,
        abortSignal: params.abortSignal,
        ...(config.providerOptions
          ? { providerOptions: config.providerOptions as any }
          : {}),
      });

      const promptTokens = estimateTokensFromChars(estimatedInputChars);
      this.aiTelemetry?.recordUsage({
        featureKey: 'DOCUMENT_RERANK',
        profile: 'RERANK',
        modelName,
        promptTokens,
        completionTokens: 0,
        totalTokens: promptTokens,
        latencyMs: Date.now() - startedAt,
        status: 'success',
      });

      return result;
    } catch (error: unknown) {
      this.aiTelemetry?.recordUsage({
        featureKey: 'DOCUMENT_RERANK',
        profile: 'RERANK',
        modelName,
        promptTokens: estimateTokensFromChars(estimatedInputChars),
        completionTokens: 0,
        latencyMs: Date.now() - startedAt,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Chuyển đổi âm thanh thành văn bản qua Vercel AI SDK `transcribe`
   */
  async transcribeAudio(params: TranscribeAudioParams) {
    const config = FEATURE_MAP.VOICE_TRANSCRIPTION;
    const model = this.aiModelFactory.getTranscriptionModel();
    const startedAt = Date.now();
    const modelName = resolveModelName(model, 'groq/whisper-large-v3-turbo');

    const baseOpenAiOptions =
      config.providerOptions?.openai &&
      typeof config.providerOptions.openai === 'object'
        ? config.providerOptions.openai
        : {};
    const trimmedLanguage = params.language?.trim();
    const trimmedMimeType = params.mimeType?.trim();
    const providerOptions = {
      ...config.providerOptions,
      openai: {
        ...baseOpenAiOptions,
        ...(trimmedMimeType ? { mediaType: trimmedMimeType } : {}),
        ...(trimmedLanguage ? { language: trimmedLanguage } : {}),
      },
    };

    try {
      const result = await transcribe({
        model,
        audio: params.audio,
        maxRetries: config.maxRetries ?? 1,
        abortSignal: params.abortSignal,
        providerOptions: providerOptions as any,
      });

      const completionTokens = estimateTokensFromChars(result.text.length);
      this.aiTelemetry?.recordUsage({
        featureKey: 'VOICE_TRANSCRIPTION',
        profile: 'TRANSCRIPTION',
        modelName,
        promptTokens: 0,
        completionTokens,
        totalTokens: completionTokens,
        latencyMs: Date.now() - startedAt,
        status: 'success',
      });

      return result;
    } catch (error: unknown) {
      this.aiTelemetry?.recordUsage({
        featureKey: 'VOICE_TRANSCRIPTION',
        profile: 'TRANSCRIPTION',
        modelName,
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: Date.now() - startedAt,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  generateText(
    messages: NonNullable<Parameters<typeof generateText>[0]['messages']>,
  ) {
    return generateText({
      model: this.aiModelFactory.getModel('VISION'),
      messages,
    });
  }

  generateTextForTask(
    task: Exclude<AiTask, 'EMBEDDING' | 'RERANK'>,
    messages: NonNullable<Parameters<typeof generateText>[0]['messages']>,
  ) {
    if (task === 'SUMMARIZE') {
      return generateText({
        model: this.aiModelFactory.getModelForTask(task),
        messages,
        providerOptions: {
          google: { responseMimeType: 'application/json' },
        },
      });
    }

    if (task === 'AUTO_HEADER') {
      return generateText({
        model: this.aiModelFactory.getModelForTask(task),
        messages,
        temperature: 0.1,
        providerOptions: {
          ollama: {
            think: false,
          },
        },
      });
    }

    return generateText({
      model: this.aiModelFactory.getModelForTask(task),
      messages,
    });
  }

  async generateObjectForTask<T = unknown>(
    task: Exclude<AiTask, 'EMBEDDING' | 'RERANK'>,
    options: {
      schema: unknown;
      schemaName?: string;
      schemaDescription?: string;
      prompt: string;
      system?: string;
      temperature?: number;
      maxRetries?: number;
      modelName?: string;
    },
  ): Promise<{ object: T }> {
    const model = options.modelName
      ? this.aiModelFactory.getCustomModel(options.modelName)
      : this.aiModelFactory.getModelForTask(task);

    const result = await generateText({
      model,
      output: Output.object({
        schema: options.schema as any,
        ...(options.schemaName ? { name: options.schemaName } : {}),
        ...(options.schemaDescription
          ? { description: options.schemaDescription }
          : {}),
      }),
      prompt: options.prompt,
      system: options.system,
      temperature: options.temperature,
      ...(options.maxRetries !== undefined
        ? { maxRetries: options.maxRetries }
        : {}),
    });
    return { object: result.output as T };
  }

  streamText(
    options: Omit<
      Parameters<typeof streamText>[0],
      'model' | 'prompt' | 'messages'
    > & {
      messages: NonNullable<Parameters<typeof streamText>[0]['messages']>;
    },
  ) {
    return streamText({
      ...options,
      model: this.aiModelFactory.getModel('STANDARD'),
    });
  }

  streamTextForTask(
    task: Exclude<AiTask, 'EMBEDDING' | 'RERANK'>,
    options: Omit<
      Parameters<typeof streamText>[0],
      'model' | 'prompt' | 'messages'
    > & {
      messages: NonNullable<Parameters<typeof streamText>[0]['messages']>;
    },
  ) {
    return streamText({
      ...options,
      model: this.aiModelFactory.getModelForTask(task),
    });
  }

  streamChatAgent(
    modelName: string,
    options: Omit<
      Parameters<typeof streamText>[0],
      'model' | 'prompt' | 'messages'
    > & {
      messages: NonNullable<Parameters<typeof streamText>[0]['messages']>;
      temperature?: number;
      maxOutputTokens?: number;
    },
  ) {
    const { temperature, maxOutputTokens, ...rest } = options;
    return streamText({
      ...rest,
      model: this.aiModelFactory.getCustomModel(modelName),
      temperature,
      maxOutputTokens,
    });
  }
}
