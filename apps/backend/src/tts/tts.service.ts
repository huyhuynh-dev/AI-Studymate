import { Injectable, Logger } from '@nestjs/common';
import { EdgeTTS } from 'node-edge-tts';
import { SynthesizeTtsDto } from './dto/synthesize-tts.dto.js';

@Injectable()
export class TtsService {
    private readonly logger = new Logger(TtsService.name);
    private readonly cache = new Map<string, Buffer>();
    private activeRequests = 0;
    private readonly maxActiveRequests = 2;
    private readonly maxCacheEntries = 50;

    async synthesize(dto: SynthesizeTtsDto): Promise<Buffer> {
        const text = dto.text.trim();
        if (!text) {
            throw new Error('Text không được để trống');
        }

        const rate = dto.rate ?? 100;
        const volume = dto.volume ?? 100;
        const pitch = dto.pitch ?? 0;
        const cacheKey = JSON.stringify({
            text,
            voice: dto.voice,
            rate,
            volume,
            pitch,
        });
        const cached = this.cache.get(cacheKey);
        if (cached) {
            this.logger.log(
                `TTS cache hit | voice=${dto.voice} | textLength=${text.length} | bytes=${cached.length}`,
            );
            return cached;
        }

        await this.waitForRequestSlot();
        this.activeRequests += 1;
        this.logger.log(
            `TTS synthesis started | voice=${dto.voice} | textLength=${text.length} | rate=${rate} | volume=${volume} | active=${this.activeRequests}`,
        );

        try {
            const result = await this.synthesizeWithRetry(dto, text, rate, volume, pitch);
            this.cache.set(cacheKey, result);
            if (this.cache.size > this.maxCacheEntries) {
                const oldestKey = this.cache.keys().next().value as string | undefined;
                if (oldestKey) this.cache.delete(oldestKey);
            }
            this.logger.log(
                `TTS synthesis completed | voice=${dto.voice} | textLength=${text.length} | bytes=${result.length}`,
            );
            return result;
        } finally {
            this.activeRequests -= 1;
        }
    }

    private async waitForRequestSlot(): Promise<void> {
        while (this.activeRequests >= this.maxActiveRequests) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    private async synthesizeWithRetry(
        dto: SynthesizeTtsDto,
        text: string,
        rate: number,
        volume: number,
        pitch: number,
    ): Promise<Buffer> {
        const formatRateValue = (value: number) =>
            value === 100 ? 'default' : `${value >= 100 ? '+' : ''}${value - 100}%`;
        const formatVolumeValue = (value: number) =>
            value === 100 ? 'default' : `${value >= 100 ? '+' : ''}${value - 100}%`;
        const formatPitchValue = (value: number) =>
            value === 0 ? 'default' : `${value >= 0 ? '+' : ''}${value}%`;
        const maxAttempts = 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const tts = new EdgeTTS({
                voice: dto.voice,
                lang: dto.voice.startsWith('vi-VN') ? 'vi-VN' : 'en-US',
                outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
                saveSubtitles: false,
                rate: formatRateValue(rate),
                volume: formatVolumeValue(volume),
                pitch: formatPitchValue(pitch),
                timeout: 30000,
            });

            const chunks: Buffer[] = [];
            try {
                for await (const chunk of tts.streamAudio(text)) {
                    if (Buffer.isBuffer(chunk)) {
                        chunks.push(chunk);
                    }
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                const isTransient =
                    message.includes('429') ||
                    message.includes('Unexpected server response') ||
                    message.includes('Timed out') ||
                    message.includes('closed before');

                this.logger.warn(
                    `TTS synthesis attempt failed | voice=${dto.voice} | attempt=${attempt}/${maxAttempts} | transient=${isTransient} | error=${message}`,
                );

                if (isTransient && attempt < maxAttempts) {
                    const delayMs = 1000 * 2 ** (attempt - 1);
                    this.logger.warn(
                        `TTS retry scheduled | voice=${dto.voice} | attempt=${attempt + 1}/${maxAttempts} | delayMs=${delayMs}`,
                    );
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                    continue;
                }
                throw error;
            }

            if (chunks.length === 0) {
                throw new Error('Edge TTS không trả về dữ liệu âm thanh');
            }
            return Buffer.concat(chunks);
        }
        throw new Error('Edge TTS không thể tổng hợp giọng nói');
    }
}
