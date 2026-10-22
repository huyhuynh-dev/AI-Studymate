import { ollama } from 'ollama-ai-provider-v2';
import { embedMany, cosineSimilarity } from 'ai';

const model = ollama.embeddingModel('nomic-embed-text-v2-moe:latest');

const { embeddings } = await embedMany({
    model: model,
    values: ['sunny day at the beach', 'rainy afternoon in the city'],
});

console.log(
    `cosine similarity: ${cosineSimilarity(embeddings[0], embeddings[1])}`,
);

console.log(embeddings);