import { Injectable } from "@nestjs/common";
import { google } from "@ai-sdk/google";
import { convertToModelMessages, streamText } from "ai";
import type { UIMessage } from "ai";
import {
    aiDocumentFormats,
    injectDocumentStateMessages,
    toolDefinitionsToToolSet,
} from "@blocknote/xl-ai/server";

export const maxDuration = 30;
export type BlocknoteToolDefinitions = Parameters<
    typeof toolDefinitionsToToolSet
>[0];

@Injectable()
export class BlocknoteAiService {
    async executeBlocknoteEditorAiActions(
        messages: UIMessage[],
        toolDefinitions: BlocknoteToolDefinitions,
        abortSignal?: AbortSignal,
    ) {
        const modelMessages = await convertToModelMessages(
            injectDocumentStateMessages(messages),
        );

        return streamText({
            model: google('gemini-3.5-flash-lite'),
            abortSignal,
            system: aiDocumentFormats.html.systemPrompt,
            messages: modelMessages,
            tools: toolDefinitionsToToolSet(toolDefinitions),
            toolChoice: 'required',
        });
    }
}