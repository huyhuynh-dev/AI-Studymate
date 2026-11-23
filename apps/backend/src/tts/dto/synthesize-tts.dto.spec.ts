import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
    EDGE_TTS_VOICES,
    SynthesizeTtsDto,
} from './synthesize-tts.dto.js';

describe('SynthesizeTtsDto', () => {
    it('exposes exactly two Vietnamese and two English voices', () => {
        expect(EDGE_TTS_VOICES).toEqual([
            'vi-VN-HoaiMyNeural',
            'vi-VN-NamMinhNeural',
            'en-US-AriaNeural',
            'en-US-GuyNeural',
        ]);
    });

    it('accepts a supported Edge TTS voice and valid audio settings', async () => {
        const dto = plainToInstance(SynthesizeTtsDto, {
            text: 'Xin chào',
            voice: 'vi-VN-HoaiMyNeural',
            rate: 100,
            volume: 80,
            pitch: 0,
        });

        await expect(validate(dto)).resolves.toHaveLength(0);
    });

    it('rejects an unsupported voice and out-of-range settings', async () => {
        const dto = plainToInstance(SynthesizeTtsDto, {
            text: 'Xin chào',
            voice: 'unsupported-voice',
            rate: 20,
            volume: 120,
            pitch: 30,
        });

        const errors = await validate(dto);
        expect(errors.map((error) => error.property)).toEqual(
            expect.arrayContaining(['voice', 'rate', 'volume', 'pitch']),
        );
    });

    it('rejects text longer than the synthesis limit', async () => {
        const dto = plainToInstance(SynthesizeTtsDto, {
            text: 'a'.repeat(12001),
            voice: 'en-US-AriaNeural',
        });

        const errors = await validate(dto);
        expect(errors.map((error) => error.property)).toContain('text');
    });
});
