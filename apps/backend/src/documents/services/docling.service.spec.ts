import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DoclingService } from './docling.service.js';
import { ConfigService } from '@nestjs/config';

describe('DoclingService', () => {
    let service: DoclingService;
    let configService: ConfigService;
    const originalFetch = global.fetch;

    beforeEach(() => {
        configService = {
            get: vi.fn((key: string) => {
                if (key === 'DOCLING_SERVER_URL') return 'http://localhost:5001';
                if (key === 'DOCLING_TIMEOUT_SECONDS') return '10';
                return undefined;
            }),
        } as unknown as ConfigService;

        service = new DoclingService(configService);
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    describe('isHealthy', () => {
        it('should return true when health check succeeds with ok', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ status: 'ok' }),
            } as Response);

            const result = await service.isHealthy();
            expect(result).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith('http://localhost:5001/health', expect.any(Object));
        });

        it('should return false when health check fails or errors', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

            const result = await service.isHealthy();
            expect(result).toBe(false);
        });
    });

    describe('convertDocumentToMarkdown', () => {
        it('should return empty string for empty buffer', async () => {
            const result = await service.convertDocumentToMarkdown(Buffer.alloc(0), 'empty.pdf');
            expect(result).toBe('');
        });

        it('should successfully submit async task, poll status and return md_content', async () => {
            const buffer = Buffer.from('dummy-pdf-content');

            global.fetch = vi.fn()
                // 1. Submit async
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ task_id: 'task-123' }),
                } as Response)
                // 2. Poll status
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ task_id: 'task-123', task_status: 'success' }),
                } as Response)
                // 3. Result
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        status: 'success',
                        document: {
                            filename: 'sample.pdf',
                            md_content: '# Heading 1\nSample markdown content',
                        },
                    }),
                } as Response);

            const result = await service.convertDocumentToMarkdown(buffer, 'sample.pdf');

            expect(result).toBe('# Heading 1\nSample markdown content');
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });

        it('should throw an error if task status reports failure', async () => {
            const buffer = Buffer.from('corrupt-pdf');

            global.fetch = vi.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ task_id: 'task-fail' }),
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        task_id: 'task-fail',
                        task_status: 'failure',
                        error_message: 'Corrupted document format',
                    }),
                } as Response);

            await expect(service.convertDocumentToMarkdown(buffer, 'corrupt.pdf')).rejects.toThrow(
                'Corrupted document format'
            );
        });
    });

    describe('chunkMarkdownHybrid', () => {
        it('should return empty array for empty or whitespace markdown', async () => {
            const result = await service.chunkMarkdownHybrid('   \n\t  ');
            expect(result).toEqual([]);
        });

        it('should successfully submit async chunk task and return structured chunks', async () => {
            const markdown = '# Section 1\nContent paragraph 1\n\n# Section 2\nContent paragraph 2';

            global.fetch = vi.fn()
                // 1. Submit async
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ task_id: 'chunk-task-123' }),
                } as Response)
                // 2. Poll status
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ task_id: 'chunk-task-123', task_status: 'success' }),
                } as Response)
                // 3. Result
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        chunks: [
                            {
                                filename: 'test.md',
                                chunk_index: 0,
                                text: 'Section 1\nContent paragraph 1',
                            },
                            {
                                filename: 'test.md',
                                chunk_index: 1,
                                text: 'Section 2\nContent paragraph 2',
                            },
                        ],
                    }),
                } as Response);

            const chunks = await service.chunkMarkdownHybrid(markdown, 'test.md');

            expect(chunks).toHaveLength(2);
            expect(chunks[0]).toEqual({
                index: 0,
                content: 'Section 1\nContent paragraph 1',
            });
            expect(chunks[1]).toEqual({
                index: 1,
                content: 'Section 2\nContent paragraph 2',
            });
        });
    });
});
