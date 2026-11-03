import { Injectable } from '@nestjs/common';
import {
  embedMany as aiEmbedMany,
  generateText as aiGenerateText,
  streamText as aiStreamText,
  Output,
} from 'ai';
import { AiModelFactory } from './ai-model.factory.js';
import type { AiTask } from './ai-model.factory.js';

@Injectable()
export class AiService {
  constructor(private readonly aiModelFactory: AiModelFactory) {}

  embedMany(values: string[]) {
    return aiEmbedMany({
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
    messages: NonNullable<Parameters<typeof aiGenerateText>[0]['messages']>,
  ) {
    return aiGenerateText({
      model: this.aiModelFactory.getModelForTask('VISION_ANALYZE'),
      messages,
    });
  }

  generateTextForTask(
    task: Exclude<AiTask, 'EMBEDDING'>,
    messages: NonNullable<Parameters<typeof aiGenerateText>[0]['messages']>,
  ) {
    if (task === 'SUMMARIZE') {
      return aiGenerateText({
        model: this.aiModelFactory.getModelForTask(task),
        messages,
        providerOptions: {
          google: { responseMimeType: 'application/json' },
        },
      });
    }

    if (task === 'AUTO_HEADER') {
      return aiGenerateText({
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

    return aiGenerateText({
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
    const result = await aiGenerateText({
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
      Parameters<typeof aiStreamText>[0],
      'model' | 'prompt' | 'messages'
    > & {
      messages: NonNullable<Parameters<typeof aiStreamText>[0]['messages']>;
    },
  ) {
    return aiStreamText({
      ...options,
      model: this.aiModelFactory.getModelForTask('BLOCKNOTE_EDITOR'),
    });
  }

  streamTextForTask(
    task: Exclude<AiTask, 'EMBEDDING'>,
    options: Omit<
      Parameters<typeof aiStreamText>[0],
      'model' | 'prompt' | 'messages'
    > & {
      messages: NonNullable<Parameters<typeof aiStreamText>[0]['messages']>;
    },
  ) {
    return aiStreamText({
      ...options,
      model: this.aiModelFactory.getModelForTask(task),
    });
  }
}
