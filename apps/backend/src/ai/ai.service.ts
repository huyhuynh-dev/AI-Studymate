import { Injectable } from '@nestjs/common';
import { embedMany as aiEmbedMany } from 'ai';
import {
  GeminiSummaryService,
  GenerateSummaryOptions,
  SummaryResult,
} from './gemini-summary.service.js';
import { getModelForTask } from './providers/ai-provider.config.js';
import {
  generateText as aiGenerateText,
  streamText as aiStreamText,
} from 'ai';

@Injectable()
export class AiService {
  constructor(
    private readonly geminiSummaryService: GeminiSummaryService,
  ) { }

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

  generateSummary(options: GenerateSummaryOptions): Promise<SummaryResult> {
    return this.geminiSummaryService.generateSummary(options);
  }

  refineSummary(currentBlocks: any[], instruction: string): Promise<SummaryResult> {
    return this.geminiSummaryService.refineSummary(currentBlocks, instruction);
  }

}
