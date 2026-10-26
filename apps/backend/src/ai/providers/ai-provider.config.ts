import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOllama } from 'ollama-ai-provider-v2';
import type { EmbeddingModel, LanguageModel } from 'ai';

export type AiTask =
    | 'EMBEDDING'
    | 'VISION_ANALYZE'
    | 'SUMMARIZE'
    | 'BLOCKNOTE_EDITOR'
    | 'CHAT_AGENT'
    | 'AUTO_HEADER';

type TaskModel = EmbeddingModel | LanguageModel;

const google = createGoogleGenerativeAI({
    apiKey:
        process.env.GOOGLE_API_KEY ??
        process.env.GEMINI_API_KEY ??
        process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const ollamaServerUrl = process.env.OLLAMA_SERVER_URL ?? 'http://127.0.0.1:11434';
const ollama = createOllama({
    baseURL: ollamaServerUrl.endsWith('/api')
        ? ollamaServerUrl
        : `${ollamaServerUrl}/api`,
});

const TASK_MODELS: Record<AiTask, TaskModel> = {
    EMBEDDING: ollama.embeddingModel('nomic-embed-text-v2-moe:latest'),
    VISION_ANALYZE: google('gemini-3.5-flash-lite'),
    SUMMARIZE: google('gemini-3.8-flash'),
    BLOCKNOTE_EDITOR: google('gemini-3.5-flash-lite'),
    CHAT_AGENT: google('gemini-3.5-flash'),
    AUTO_HEADER: ollama('qwen3.5:2b'),
};

export function getModelForTask(task: 'EMBEDDING'): EmbeddingModel;
export function getModelForTask(
    task: Exclude<AiTask, 'EMBEDDING'>,
): LanguageModel;
export function getModelForTask(task: AiTask): TaskModel {
    const model = TASK_MODELS[task];
    if (!model) {
        throw new Error(`No model found for task: ${task}`);
    }
    return model;
}
