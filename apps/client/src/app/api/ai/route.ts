
import { google } from "@ai-sdk/google";
import { convertToModelMessages, streamText } from "ai";
import {
    aiDocumentFormats,
    injectDocumentStateMessages,
    toolDefinitionsToToolSet,
} from "@blocknote/xl-ai/server";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
    const { messages, toolDefinitions } = await req.json();

    const result = streamText({
        model: google("gemini-3.5-flash-lite"), // see https://ai-sdk.dev/docs/foundations/providers-and-models
        system: aiDocumentFormats.html.systemPrompt,
        messages: await convertToModelMessages(
            injectDocumentStateMessages(messages),
        ),
        tools: toolDefinitionsToToolSet(toolDefinitions),
        toolChoice: "required",
    });

    return result.toUIMessageStreamResponse();
}