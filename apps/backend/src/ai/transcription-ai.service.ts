import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { NoTranscriptGeneratedError } from 'ai';
import { AiService } from './ai.service.js';

export const MAX_TRANSCRIPTION_AUDIO_BYTES = 10 * 1024 * 1024;
export const TRANSCRIPTION_TIMEOUT_MS = 30_000;

export const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/flac',
]);

export interface TranscribeAudioInput {
  audioBuffer: Buffer;
  mimeType: string;
  language?: string;
  abortSignal?: AbortSignal;
}

export interface TranscribeAudioOutput {
  text: string;
  language?: string;
  durationInSeconds?: number;
}

export function normalizeAudioMimeType(rawMimeType: string): string {
  return rawMimeType.split(';')[0]?.trim().toLowerCase() ?? '';
}

@Injectable()
export class TranscriptionAiService {
  private readonly logger = new Logger(TranscriptionAiService.name);

  constructor(private readonly aiService: AiService) {}

  async transcribe(
    input: TranscribeAudioInput,
  ): Promise<TranscribeAudioOutput> {
    const normalizedMime = normalizeAudioMimeType(input.mimeType);
    if (!ALLOWED_AUDIO_MIME_TYPES.has(normalizedMime)) {
      throw new BadRequestException(
        `Định dạng âm thanh không được hỗ trợ: ${input.mimeType}`,
      );
    }

    if (!input.audioBuffer || input.audioBuffer.byteLength === 0) {
      throw new BadRequestException('Dữ liệu âm thanh trống.');
    }

    if (input.audioBuffer.byteLength > MAX_TRANSCRIPTION_AUDIO_BYTES) {
      throw new BadRequestException(
        'Tệp âm thanh vượt quá giới hạn tối đa 10 MB.',
      );
    }

    const timeoutSignal = AbortSignal.timeout(TRANSCRIPTION_TIMEOUT_MS);
    const combinedSignal = input.abortSignal
      ? AbortSignal.any([input.abortSignal, timeoutSignal])
      : timeoutSignal;

    try {
      const result = await this.aiService.transcribeAudio({
        audio: input.audioBuffer,
        mimeType: normalizedMime,
        language: input.language,
        abortSignal: combinedSignal,
      });

      return {
        text: result.text.trim(),
        language: result.language,
        durationInSeconds: result.durationInSeconds,
      };
    } catch (error: unknown) {
      if (NoTranscriptGeneratedError.isInstance(error)) {
        return {
          text: '',
          language: undefined,
          durationInSeconds: undefined,
        };
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Lỗi khi chuyển đổi giọng nói thành văn bản: ${message}`);
      throw error;
    }
  }
}
