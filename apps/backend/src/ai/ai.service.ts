import { Injectable } from '@nestjs/common';
import {
  embedMany,
  generateText,
  streamText,
  Output,
} from 'ai';
import { AiModelFactory } from './ai-model.factory.js';
import type { AiTask } from './ai-model.factory.js';

@Injectable()
export class AiService {
  constructor(private readonly aiModelFactory: AiModelFactory) { }

  embedMany(values: string[]) {
    return embedMany({
      model: this.aiModelFactory.getModelForTask('EMBEDDING'),
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
      model: this.aiModelFactory.getModelForTask('VISION_ANALYZE'),
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
      prompt: string;
      system?: string;
      temperature?: number;
    },
  ): Promise<{ object: T }> {
    const result = await generateText({
      model: this.aiModelFactory.getModelForTask(task),
      output: Output.object({
        schema: options.schema as any,
      }),
      prompt: options.prompt,
      system: options.system,
      temperature: options.temperature,
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
      model: this.aiModelFactory.getModelForTask('BLOCKNOTE_EDITOR'),
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
      model: this.aiModelFactory.getChatAgentModel(modelName),
      temperature,
      maxOutputTokens,
    });
  }
}
