import {
    IsHexColor,
    IsInt,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateSubjectDto {
    @IsOptional()
    @IsString({ message: 'Tên không gian học tập phải là chuỗi ký tự' })
    @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
    @MaxLength(255, { message: 'Tên không gian học tập không được vượt quá 255 ký tự' })
    name?: string;

    @IsOptional()
    @IsHexColor({ message: 'Mã màu phải là định dạng hex hợp lệ' })
    @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
        message: 'Mã màu phải có định dạng hex 3 hoặc 6 ký tự kèm dấu # (ví dụ: #fff hoặc #ffffff)',
    })
    color?: string;

    @IsOptional()
    @ValidateIf((_, value: unknown) => value !== null && value !== undefined)
    @IsString({ message: 'Ngày thi phải là chuỗi ngày YYYY-MM-DD' })
    @Matches(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'Ngày thi phải có định dạng YYYY-MM-DD',
    })
    examDate?: string | null;

    @IsOptional()
    @ValidateIf((_, value: unknown) => value !== null && value !== undefined)
    @Type(() => Number)
    @IsInt({ message: 'Điểm mục tiêu phải là số nguyên (%)' })
    @Min(50, { message: 'Điểm mục tiêu tối thiểu là 50%' })
    @Max(100, { message: 'Điểm mục tiêu tối đa là 100%' })
    targetScore?: number | null;
}
