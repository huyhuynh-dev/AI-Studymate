import { Injectable } from '@nestjs/common';
import { convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
import {
  aiDocumentFormats,
  injectDocumentStateMessages,
  toolDefinitionsToToolSet,
} from '@blocknote/xl-ai/server';
import { AiService } from './ai.service.js';

export const maxDuration = 30;
export type BlocknoteToolDefinitions = Parameters<
  typeof toolDefinitionsToToolSet
>[0];

@Injectable()
export class BlocknoteService {
  constructor(private readonly aiService: AiService) {}

  async executeAiActions(
    messages: UIMessage[],
    toolDefinitions: BlocknoteToolDefinitions,
    abortSignal?: AbortSignal,
  ) {
    const modelMessages = await convertToModelMessages(
      injectDocumentStateMessages(messages),
    );

    return this.aiService.streamText({
      abortSignal,
      system: aiDocumentFormats.html.systemPrompt,
      messages: modelMessages,
      tools: toolDefinitionsToToolSet(toolDefinitions),
      toolChoice: 'required',
    });
  }
}
