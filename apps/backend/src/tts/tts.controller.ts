import {
    BadRequestException,
    Body,
    Controller,
    Logger,
    Post,
    Res,
    StreamableFile,
    TooManyRequestsException,
} from '@nestjs/common';
import type { Response } from 'express';
import { SynthesizeTtsDto } from './dto/synthesize-tts.dto.js';
import { TtsService } from './tts.service.js';

@Controller('tts')
export class TtsController {
    private readonly logger = new Logger(TtsController.name);

    constructor(private readonly ttsService: TtsService) {}

    @Post('synthesize')
    async synthesize(
        @Body() dto: SynthesizeTtsDto,
        @Res({ passthrough: true }) response: Response,
    ): Promise<StreamableFile> {
        if (!dto.text?.trim()) {
            throw new BadRequestException('Text không được để trống');
        }

        try {
            const audio = await this.ttsService.synthesize(dto);
            response.set({
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'private, max-age=300',
            });
            this.logger.log(
                `TTS request completed | voice=${dto.voice} | textLength=${dto.text.trim().length} | bytes=${audio.length}`,
            );
            return new StreamableFile(audio);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(
                `TTS request failed | voice=${dto.voice} | textLength=${dto.text.trim().length} | error=${message}`,
            );
            if (message.includes('429') || message.includes('Unexpected server response')) {
                throw new TooManyRequestsException(
                    'Dịch vụ giọng đọc đang tạm thời quá tải. Vui lòng thử lại sau ít phút.',
                );
            }
            throw error;
        }
    }
}
