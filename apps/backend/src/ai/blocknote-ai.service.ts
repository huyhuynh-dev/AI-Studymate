import { Injectable } from "@nestjs/common";
import { google } from "@ai-sdk/google";
import { convertToModelMessages, streamText } from "ai";
import type { LanguageModel, UIMessage } from "ai";
import {
    aiDocumentFormats,
    injectDocumentStateMessages,
    toolDefinitionsToToolSet,
} from "@blocknote/xl-ai/server";
import { getModelForTask } from "./providers/ai-provider.config.js";

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
        const model = getModelForTask('BLOCKNOTE_EDITOR');

        const modelMessages = await convertToModelMessages(
            injectDocumentStateMessages(messages),
        );

        return streamText({
            model: model,
            abortSignal,
            system: aiDocumentFormats.html.systemPrompt,
            messages: modelMessages,
            tools: toolDefinitionsToToolSet(toolDefinitions),
            toolChoice: 'required',
        });
    }
}