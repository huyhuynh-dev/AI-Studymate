import { Injectable } from '@nestjs/common';
import { convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
import {
  aiDocumentFormats,
  injectDocumentStateMessages,
  toolDefinitionsToToolSet,
} from '@blocknote/xl-ai/server';
import { AiService } from './ai.service.js';
import { CURSOR_INSERTION_RULES } from './prompts/templates/blocknote.prompt.js';

export const maxDuration = 30;

export { CURSOR_INSERTION_RULES };

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

    const prepared = this.aiService.prepare('BLOCKNOTE_EDIT', {
      baseHtmlSystemPrompt: aiDocumentFormats.html.systemPrompt,
    });

    return this.aiService.streamText({
      abortSignal,
      system: prepared.system,
      messages: modelMessages,
      tools: toolDefinitionsToToolSet(toolDefinitions),
      toolChoice: 'required',
    });
  }
}
