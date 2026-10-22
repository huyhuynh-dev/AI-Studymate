import { Injectable } from '@nestjs/common';
import { embedMany as aiEmbedMany } from 'ai';
import { GeminiVisionService } from './gemini-vision.service.js';
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
import { google } from 'googleapis';

@Injectable()
export class AiService {
  constructor(
    private readonly geminiVisionService: GeminiVisionService,
    private readonly geminiSummaryService: GeminiSummaryService,
    private readonly blocknoteAiService: BlocknoteAiService,
  ) { }

  extractTextFromImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
    return this.geminiVisionService.extractTextFromImage(imageBuffer, mimeType);
  }

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
