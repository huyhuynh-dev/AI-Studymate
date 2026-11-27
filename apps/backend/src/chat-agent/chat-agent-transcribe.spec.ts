import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response as ExpressResponse } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { ChatAgentController } from './chat-agent.controller.js';
import { ChatAgentService } from './chat-agent.service.js';
import { TranscribeAudioDto } from './dto/transcribe-audio.dto.js';
import type { ChatAgentRepoService } from '../repo/chat-agent-repo/chat-agent-repo.service.js';
import type { ChatAgentAiService } from '../ai/chat-agent-ai.service.js';
import type { RetrievalService } from '../documents/services/retrieval.service.js';
import {
  MAX_TRANSCRIPTION_AUDIO_BYTES,
  type TranscriptionAiService,
} from '../ai/transcription-ai.service.js';

describe('ChatAgent Voice Transcription Endpoint & DTO', () => {
  it('validates TranscribeAudioDto strictly with whitelist & forbidNonWhitelisted', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    const valid = await pipe.transform(
      {
        audioBase64: 'GkXfoQ==',
        mimeType: 'audio/webm;codecs=opus',
        language: 'vi',
      },
      { type: 'body', metatype: TranscribeAudioDto },
    );
    expect(valid).toBeInstanceOf(TranscribeAudioDto);

    await expect(
      pipe.transform(
        {
          audioBase64: 'GkXfoQ==',
          mimeType: 'audio/webm',
          unknownExtraField: 'not-allowed',
        },
        { type: 'body', metatype: TranscribeAudioDto },
      ),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        {
          audioBase64: '',
          mimeType: 'audio/webm',
        },
        { type: 'body', metatype: TranscribeAudioDto },
      ),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        {
          audioBase64: 'GkXfoQ==',
          mimeType: 'audio/webm',
          language: 'invalid-lang-123',
        },
        { type: 'body', metatype: TranscribeAudioDto },
      ),
    ).rejects.toThrow();
  });

  it('delegates controller.transcribeAudio with userId and dto to ChatAgentService', async () => {
    const transcribeMock = vi.fn().mockResolvedValue({
      text: 'Tóm tắt chương 3',
      language: 'Vietnamese',
      durationInSeconds: 1.5,
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatAgentController],
      providers: [
        {
          provide: ChatAgentService,
          useValue: {
            transcribeAudio: transcribeMock,
          },
        },
      ],
    }).compile();

    const controller = module.get<ChatAgentController>(ChatAgentController);
    const req = {
      user: { userId: 'user-123' },
      on: vi.fn(),
    } as unknown as Request;
    const res = {
      writableEnded: false,
    } as unknown as ExpressResponse;

    const result = await controller.transcribeAudio(req, res, {
      audioBase64: 'GkXfoQ==',
      mimeType: 'audio/webm',
    });

    expect(result).toEqual({
      text: 'Tóm tắt chương 3',
      language: 'Vietnamese',
      durationInSeconds: 1.5,
    });
    expect(transcribeMock).toHaveBeenCalledWith(
      'user-123',
      { audioBase64: 'GkXfoQ==', mimeType: 'audio/webm' },
      expect.any(AbortSignal),
    );
  });

  it('decodes base64 (including data URI prefix) in ChatAgentService.transcribeAudio and enforces size/format guards', async () => {
    const transcribeSpy = vi.fn().mockResolvedValue({
      text: 'Độ phức tạp của QuickSort',
      language: 'Vietnamese',
      durationInSeconds: 2.0,
    });
    const transcriptionAiMock = {
      transcribe: transcribeSpy,
    } as unknown as TranscriptionAiService;

    const service = new ChatAgentService(
      {} as ChatAgentRepoService,
      {} as ChatAgentAiService,
      {} as RetrievalService,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      transcriptionAiMock,
    );

    const payloadBytes = Buffer.from([26, 69, 223, 163, 9, 10]);
    const result = await service.transcribeAudio('user-1', {
      audioBase64: `data:audio/webm;base64,${payloadBytes.toString('base64')}`,
      mimeType: 'audio/webm;codecs=opus',
    });

    expect(result.text).toBe('Độ phức tạp của QuickSort');
    expect(transcribeSpy).toHaveBeenCalledWith({
      audioBuffer: payloadBytes,
      mimeType: 'audio/webm;codecs=opus',
      language: undefined,
      abortSignal: undefined,
    });

    await expect(
      service.transcribeAudio('user-1', {
        audioBase64: '***invalid-base64***',
        mimeType: 'audio/webm',
      }),
    ).rejects.toThrow(BadRequestException);

    const oversizedBase64 = Buffer.alloc(MAX_TRANSCRIPTION_AUDIO_BYTES + 1).toString('base64');
    await expect(
      service.transcribeAudio('user-1', {
        audioBase64: oversizedBase64,
        mimeType: 'audio/webm',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
