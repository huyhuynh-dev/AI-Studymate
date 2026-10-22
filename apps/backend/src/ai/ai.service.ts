import { Injectable } from '@nestjs/common';
import { embedMany as aiEmbedMany } from 'ai';
import {
  GeminiSummaryService,
  GenerateSummaryOptions,
  SummaryResult,
} from './gemini-summary.service.js';
import type { UIMessage } from 'ai';
import {
  BlocknoteAiService,
  BlocknoteToolDefinitions,
} from './blocknote-ai.service.js';
import { getModelForTask } from './providers/ai-provider.config.js';
import { generateText as aiGenerateText } from 'ai';

@Injectable()
export class AiService {
  constructor(
    private readonly geminiSummaryService: GeminiSummaryService,
    private readonly blocknoteAiService: BlocknoteAiService,
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

  generateSummary(options: GenerateSummaryOptions): Promise<SummaryResult> {
    return this.geminiSummaryService.generateSummary(options);
  }

  refineSummary(currentBlocks: any[], instruction: string): Promise<SummaryResult> {
    return this.geminiSummaryService.refineSummary(currentBlocks, instruction);
  }

  executeBlocknoteEditorAiActions(
    messages: UIMessage[],
    toolDefinitions: BlocknoteToolDefinitions,
    abortSignal?: AbortSignal,
  ) {
    return this.blocknoteAiService.executeBlocknoteEditorAiActions(
      messages,
      toolDefinitions,
      abortSignal,
    );
  }
}
