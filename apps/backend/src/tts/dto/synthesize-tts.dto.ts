import {
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

export const EDGE_TTS_VOICES = [
    'vi-VN-HoaiMyNeural',
    'vi-VN-NamMinhNeural',
    'en-US-AriaNeural',
    'en-US-GuyNeural',
] as const;

export class SynthesizeTtsDto {
    @IsString()
    @MaxLength(12000)
    text: string;

    @IsIn([...EDGE_TTS_VOICES])
    voice: (typeof EDGE_TTS_VOICES)[number];

    @IsOptional()
    @IsInt()
    @Min(50)
    @Max(200)
    rate?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100)
    volume?: number;

    @IsOptional()
    @IsInt()
    @Min(-20)
    @Max(20)
    pitch?: number;
}
