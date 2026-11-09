import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsIn,
    IsNotEmpty,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
import { QuestionTypeEnum } from '../../generated/prisma/client.js';

export class QuizOptionDto {
    @IsString()
    @IsNotEmpty({ message: 'ID đáp án không được để trống' })
    id!: string;

    @IsString()
    @IsNotEmpty({ message: 'Nội dung đáp án không được để trống' })
    text!: string;

    @IsBoolean()
    isCorrect!: boolean;
}

export class QuestionDraftDto {
    @IsOptional()
    @IsString()
    id?: string;

    @IsEnum(QuestionTypeEnum, { message: 'Loại câu hỏi không hợp lệ' })
    type!: QuestionTypeEnum;

    @IsString()
    @IsNotEmpty({ message: 'Nội dung câu hỏi không được để trống' })
    text!: string;

    @IsOptional()
    @IsString()
    imageUrl?: string | null;

    @IsOptional()
    @IsString()
    audioUrl?: string | null;

    @Type(() => Number)
    @IsNumber()
    @Min(0, { message: 'Điểm câu hỏi không được nhỏ hơn 0' })
    points!: number;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => QuizOptionDto)
    options?: QuizOptionDto[] | null;

    @IsOptional()
    @IsString()
    sampleAnswer?: string | null;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    gradingCriteria?: string[];

    @IsOptional()
    @IsString()
    explanation?: string | null;
}

export class CreateQuizDto {
    @IsString()
    @IsNotEmpty({ message: 'Tên bài kiểm tra không được để trống' })
    @MaxLength(255, { message: 'Tên bài kiểm tra không được vượt quá 255 ký tự' })
    title!: string;

    @IsOptional()
    @IsString()
    description?: string | null;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1, { message: 'Thời gian làm bài phải lớn hơn 0 giây' })
    timeLimitSec?: number | null;

    @IsArray({ message: 'Danh sách câu hỏi phải là một mảng' })
    @ValidateNested({ each: true })
    @Type(() => QuestionDraftDto)
    questions!: QuestionDraftDto[];
}

export class UpdateQuizDto extends CreateQuizDto {}

export class AttemptConfigDto {
    @IsString()
    @IsIn(['practice', 'exam'], { message: 'Chế độ làm bài phải là practice hoặc exam' })
    mode!: 'practice' | 'exam';

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    timeLimitSec?: number | null;

    @IsArray()
    @IsString({ each: true })
    questionOrder!: string[];

    @IsOptional()
    @IsObject()
    optionOrder?: Record<string, string[]>;
}

export class StartAttemptDto {
    @ValidateNested()
    @Type(() => AttemptConfigDto)
    @IsObject()
    config!: AttemptConfigDto;
}

export class SaveAnswerDto {
    @IsOptional()
    @IsString()
    questionId?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    selectedOptionIds?: string[];

    @IsOptional()
    @IsString()
    textAnswer?: string;

    @IsOptional()
    @IsBoolean()
    isFlagged?: boolean;
}

export class SaveProgressDto {
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    timeSpentSec!: number;
}

export class SubmitAttemptDto {
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    timeSpentSec!: number;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SaveAnswerDto)
    answers?: SaveAnswerDto[];
}

export class OverrideEvaluationDto {
    @IsString()
    @IsIn(['correct', 'partial', 'incorrect'], {
        message: 'Trạng thái đánh giá phải là correct, partial hoặc incorrect',
    })
    status!: 'correct' | 'partial' | 'incorrect';
}
