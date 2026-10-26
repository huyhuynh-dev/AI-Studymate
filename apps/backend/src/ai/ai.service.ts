import { Injectable } from '@nestjs/common';
import { embedMany as aiEmbedMany } from 'ai';
import { getModelForTask } from './providers/ai-provider.config.js';
import {
  generateText as aiGenerateText,
  streamText as aiStreamText,
} from 'ai';
import type { AiTask } from './providers/ai-provider.config.js';

@Injectable()
export class AiService {

  embedMany(values: string[]) {
    return aiEmbedMany({
      model: getModelForTask('EMBEDDING'),
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
      model: getModelForTask('VISION_ANALYZE'),
      messages,
    });
  }

  generateTextForTask(
    task: Exclude<AiTask, 'EMBEDDING'>,
    messages: NonNullable<Parameters<typeof aiGenerateText>[0]['messages']>,
    systemPrompt?: string,
  ) {
    if (task === 'SUMMARIZE') {
      return aiGenerateText({
        model: getModelForTask(task),
        messages,
        providerOptions: {
          google: { responseMimeType: 'application/json' },
        },
      });
    }

    if (task === 'AUTO_HEADER') {
      return aiGenerateText({
        model: getModelForTask(task),
        system: systemPrompt,
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
      model: getModelForTask(task),
      messages,
    });
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
      model: getModelForTask('BLOCKNOTE_EDITOR'),
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
      model: getModelForTask(task),
    });
  }

}
