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

// Bổ sung quy tắc bắt buộc cho AI trong trình soạn thảo BlockNote:
// 1. Không bao giờ trả về mảng operations rỗng (kể cả khi người dùng gõ lời chào hay câu hỏi ngắn).
// 2. Khi không có selection (selection: false), mặc định luôn dùng "add" ngay tại vị trí {"cursor": true}.
const CURSOR_INSERTION_RULES = `CRITICAL RULES FOR DOCUMENT OPERATIONS (HIGHEST PRIORITY):
1. NEVER return an empty "operations" array ("operations": []). Every user prompt (even a greeting like "Xin chào!", a short question, or a topic name) is entered inside the document editor and MUST result in at least one document operation. If the user greets you or asks a question, write a helpful response as new HTML block(s) inserted into the document.
2. When NO selection is active (selection is false) and the document is NOT empty:
   - Unless the user explicitly asks to edit, replace, or delete specific existing text, DO NOT update or delete existing blocks; ALWAYS use the "add" operation to insert new block(s).
   - Unless the user explicitly specifies another location in the document, you MUST insert the new block(s) at the {"cursor": true} marker: set "referenceId" to the EXACT id (including the trailing "$") of the block immediately BEFORE {"cursor": true} with "position": "after" (or if {"cursor": true} is at the very start before any block, use the block immediately after it with "position": "before").
   - NEVER use the first block of the document as "referenceId" unless {"cursor": true} is immediately adjacent to that first block or the user explicitly asks to write at the top/beginning of the document.
3. Each entry in the "blocks" array of an "add" operation MUST be a single, complete, valid top-level HTML element (e.g., "<p>...</p>", "<h2>...</h2>", "<table><thead>...</thead><tbody>...</tbody></table>", "<ul><li>...</li></ul>").`;
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
      system: `${aiDocumentFormats.html.systemPrompt}\n\n${CURSOR_INSERTION_RULES}`,
      messages: modelMessages,
      tools: toolDefinitionsToToolSet(toolDefinitions),
      toolChoice: 'required',
    });
  }
}
