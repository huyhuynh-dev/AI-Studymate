import { describe, it, expect } from 'vitest';
import { chunkText } from './text-chunker.js';

describe('chunkText', () => {
    it('returns empty array for empty or whitespace-only text', () => {
        expect(chunkText('')).toEqual([]);
        expect(chunkText('   \n\t  ')).toEqual([]);
    });

    it('returns single chunk when text is shorter than chunkSize', () => {
        const text = 'Định lý Pythagore phát biểu rằng trong một tam giác vuông...';
        const chunks = chunkText(text, { chunkSize: 500, chunkOverlap: 50 });
        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toEqual({
            index: 0,
            content: text,
        });
    });

    it('splits long text into multiple chunks with sequential indices and respects chunkSize', () => {
        const paragraphs = Array.from(
            { length: 10 },
            (_, i) => `Đoạn văn thứ ${i + 1}: Nội dung bài giảng môn Trí tuệ nhân tạo và Học sâu (Deep Learning) với các khái niệm về mạng nơ-ron tích chập CNN, RNN, Transformer.`
        ).join('\n\n');

        const chunks = chunkText(paragraphs, { chunkSize: 350, chunkOverlap: 60 });
        expect(chunks.length).toBeGreaterThan(2);

        chunks.forEach((chunk, idx) => {
            expect(chunk.index).toBe(idx);
            expect(chunk.content.length).toBeLessThanOrEqual(350);
            expect(chunk.content.length).toBeGreaterThan(0);
        });
    });

    it('handles continuous string without separators by character splitting', () => {
        const continuous = 'A'.repeat(1200);
        const chunks = chunkText(continuous, { chunkSize: 500, chunkOverlap: 100 });
        expect(chunks.length).toBe(3);
        expect(chunks[0].content.length).toBe(500);
        expect(chunks[1].content.length).toBe(500);
        expect(chunks[2].content.length).toBe(400);
    });
});
