import { Injectable } from '@nestjs/common';
import {
  embedMany,
  generateText,
  streamText,
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

@Injectable()
export class AiService {
  constructor(
    private readonly aiModelFactory: AiModelFactory,
    private readonly promptRegistry: PromptRegistryService,
  ) {}

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

    const result = await generateText({
      model: preparedObj.model,
      output: Output.object({
        schema: targetSchema,
        ...(targetSchemaName ? { name: targetSchemaName } : {}),
        ...(targetSchemaDesc ? { description: targetSchemaDesc } : {}),
      }),
      prompt: preparedObj.prompt,
      system: preparedObj.system,
      temperature: options?.temperature ?? preparedObj.temperature,
      maxRetries: options?.maxRetries ?? preparedObj.maxRetries,
    });

    return {
      object: result.output as [TOutput] extends [never]
        ? FeatureOutputMap[K]
        : TOutput,
    };
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

    return generateText({
      model: prepared.model,
      prompt: prepared.prompt,
      system: prepared.system,
      temperature: options?.temperature ?? prepared.temperature,
      providerOptions: prepared.providerOptions as any,
    });
  }

  embedMany(values: string[]) {
    return embedMany({
      model: this.aiModelFactory.getEmbeddingModel(),
      values,
      providerOptions: {
        google: {
          outputDimensionality: 768,
        },
      },
    });
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
    task: Exclude<AiTask, 'EMBEDDING'>,
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
    task: Exclude<AiTask, 'EMBEDDING'>,
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
    task: Exclude<AiTask, 'EMBEDDING'>,
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
