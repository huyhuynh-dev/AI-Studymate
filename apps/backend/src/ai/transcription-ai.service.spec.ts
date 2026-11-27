import { BadRequestException } from '@nestjs/common';
import { APICallError, NoTranscriptGeneratedError } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleTranscriptionModel } from './models/openai-compatible-transcription.model.js';
import {
  MAX_TRANSCRIPTION_AUDIO_BYTES,
  TranscriptionAiService,
  normalizeAudioMimeType,
} from './transcription-ai.service.js';
import type { AiService } from './ai.service.js';

describe('OpenAICompatibleTranscriptionModel', () => {
  it('posts multipart FormData to /audio/transcriptions and maps verbose_json response', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(_url).toBe('http://localhost:20128/v1/audio/transcriptions');
      expect(init?.method).toBe('POST');

      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe('Bearer test-secret-key');

      const formData = init?.body as FormData;
      expect(formData).toBeInstanceOf(FormData);
      expect(formData.get('model')).toBe('groq/whisper-large-v3-turbo');
      expect(formData.get('response_format')).toBe('verbose_json');
      expect(formData.get('temperature')).toBe('0');
      expect(formData.get('language')).toBeNull();

      const file = formData.get('file') as File;
      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe('recording.webm');
      expect(file.type).toBe('audio/webm');

      return new Response(
        JSON.stringify({
          task: 'transcribe',
          language: 'Vietnamese',
          duration: 1.75,
          text: 'Hãy giải thích cây AVL',
          segments: [
            { start: 0, end: 1.75, text: 'Hãy giải thích cây AVL' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const model = new OpenAICompatibleTranscriptionModel(
      'groq/whisper-large-v3-turbo',
      {
        provider: 'openai-compatible.transcription',
        baseURL: 'http://localhost:20128/v1/',
        apiKey: 'test-secret-key',
        fetch: fetchMock as typeof fetch,
      },
    );

    const res = await model.doGenerate({
      audio: new Uint8Array([26, 69, 223, 163, 1, 2]),
      mediaType: 'audio/webm;codecs=opus',
      providerOptions: {
        openai: {
          temperature: 0,
          responseFormat: 'verbose_json',
        },
      },
    });

    expect(res.text).toBe('Hãy giải thích cây AVL');
    expect(res.language).toBe('Vietnamese');
    expect(res.durationInSeconds).toBe(1.75);
    expect(res.segments).toEqual([
      { text: 'Hãy giải thích cây AVL', startSecond: 0, endSecond: 1.75 },
    ]);
  });

  it('throws APICallError without exposing API key when endpoint returns HTTP 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: 'Invalid API key' } }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const model = new OpenAICompatibleTranscriptionModel(
      'groq/whisper-large-v3-turbo',
      {
        provider: 'openai-compatible.transcription',
        baseURL: 'http://localhost:20128/v1',
        apiKey: 'sk-super-secret-value',
        fetch: fetchMock as typeof fetch,
      },
    );

    try {
      await model.doGenerate({
        audio: new Uint8Array([1, 2, 3, 4]),
        mediaType: 'audio/wav',
      });
      throw new Error('Expected APICallError to be thrown');
    } catch (error) {
      expect(APICallError.isInstance(error)).toBe(true);
      if (APICallError.isInstance(error)) {
        expect(error.statusCode).toBe(401);
        expect(error.isRetryable).toBe(false);
        expect(error.message).toContain('Invalid API key');
        expect(error.message).not.toContain('sk-super-secret-value');
      }
    }
  });
});

describe('TranscriptionAiService', () => {
  it('normalizes codec suffix from MIME types', () => {
    expect(normalizeAudioMimeType('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(normalizeAudioMimeType(' AUDIO/MP4 ; charset=utf-8 ')).toBe('audio/mp4');
  });

  it('validates MIME type, empty buffer, and 10 MiB max audio size', async () => {
    const aiServiceMock = {
      transcribeAudio: vi.fn(),
    } as unknown as AiService;
    const service = new TranscriptionAiService(aiServiceMock);

    await expect(
      service.transcribe({
        audioBuffer: Buffer.from([1, 2, 3]),
        mimeType: 'text/plain',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.transcribe({
        audioBuffer: Buffer.alloc(0),
        mimeType: 'audio/webm',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.transcribe({
        audioBuffer: Buffer.alloc(MAX_TRANSCRIPTION_AUDIO_BYTES + 1),
        mimeType: 'audio/webm',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns trimmed text on success and empty text on NoTranscriptGeneratedError', async () => {
    const transcribeAudioMock = vi
      .fn()
      .mockResolvedValueOnce({
        text: '  So sánh QuickSort và MergeSort  ',
        language: 'Vietnamese',
        durationInSeconds: 3.2,
      })
      .mockRejectedValueOnce(
        new NoTranscriptGeneratedError({
          responses: [
            {
              timestamp: new Date(),
              modelId: 'groq/whisper-large-v3-turbo',
            },
          ],
        }),
      );

    const service = new TranscriptionAiService({
      transcribeAudio: transcribeAudioMock,
    } as unknown as AiService);

    const okResult = await service.transcribe({
      audioBuffer: Buffer.from([26, 69, 223, 163]),
      mimeType: 'audio/webm;codecs=opus',
    });
    expect(okResult).toEqual({
      text: 'So sánh QuickSort và MergeSort',
      language: 'Vietnamese',
      durationInSeconds: 3.2,
    });
    expect(transcribeAudioMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mimeType: 'audio/webm',
      }),
    );

    const emptyResult = await service.transcribe({
      audioBuffer: Buffer.from([26, 69, 223, 163]),
      mimeType: 'audio/webm',
    });
    expect(emptyResult).toEqual({
      text: '',
      language: undefined,
      durationInSeconds: undefined,
    });
  });
});
