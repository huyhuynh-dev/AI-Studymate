import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { CardTypeEnum } from '../../generated/prisma/client.js';

export class CreateFlashcardDto {
    @IsUUID()
    @IsNotEmpty()
    deckId: string;

    @IsString()
    @IsNotEmpty()
    frontText: string;

    @IsOptional()
    @IsString()
    backText?: string;

    @IsOptional()
    @IsEnum(CardTypeEnum)
    cardType?: CardTypeEnum;

    @IsOptional()
    @IsString()
    imageUrl?: string;

    @IsOptional()
    @IsString()
    audioUrl?: string;
}

export class UpdateFlashcardDto {
    @IsOptional()
    @IsString()
    frontText?: string;

    @IsOptional()
    @IsString()
    backText?: string;

    @IsOptional()
    @IsEnum(CardTypeEnum)
    cardType?: CardTypeEnum;

    @IsOptional()
    @IsString()
    imageUrl?: string;

    @IsOptional()
    @IsString()
    audioUrl?: string;
}

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy' | 1 | 2 | 3 | 4;

export class ReviewFlashcardDto {
    @IsNotEmpty()
    rating: ReviewRating;
}
