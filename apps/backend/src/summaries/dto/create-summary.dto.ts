import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SummaryScope {
    CONVERSATION = 'conversation',
    DOCUMENT = 'document',
    SECTION = 'section',
}

export enum SummaryMode {
    KEY_TAKEAWAYS = 'key_takeaways',
    STUDY_GUIDE = 'study_guide',
    QA_STYLE = 'qa_style',
}

export enum SummaryLength {
    SHORT = 'short',
    STANDARD = 'standard',
    DETAILED = 'detailed',
}

export class SectionRangeDto {
    @IsOptional()
    fromPage?: number;

    @IsOptional()
    toPage?: number;

    @IsOptional()
    @IsString()
    customText?: string;
}

export class CreateSummaryDto {
    @IsNotEmpty({ message: 'Phạm vi tóm tắt (scope) không được để trống' })
    @IsEnum(SummaryScope, {
        message: 'Scope phải là conversation, document hoặc section',
    })
    scope: SummaryScope;

    @IsOptional()
    @IsUUID('4', { message: 'documentId phải là UUID hợp lệ' })
    documentId?: string;

    @IsNotEmpty({ message: 'Kiểu tóm tắt (mode) không được để trống' })
    @IsEnum(SummaryMode, {
        message: 'Mode phải là key_takeaways, study_guide hoặc qa_style',
    })
    mode: SummaryMode;

    @IsNotEmpty({ message: 'Độ dài mong muốn (length) không được để trống' })
    @IsEnum(SummaryLength, {
        message: 'Length phải là short, standard hoặc detailed',
    })
    length: SummaryLength;

    @IsOptional()
    @ValidateNested()
    @Type(() => SectionRangeDto)
    sectionRange?: SectionRangeDto;

    @IsOptional()
    @IsString()
    customInstruction?: string;
}
