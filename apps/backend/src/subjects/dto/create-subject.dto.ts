import { IsHexColor, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateSubjectDto {
    @IsNotEmpty({ message: 'Tên không gian học tập không được để trống' })
    @IsString({ message: 'Tên không gian học tập phải là chuỗi ký tự' })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @MaxLength(255, { message: 'Tên không gian học tập không được vượt quá 255 ký tự' })
    name: string;

    @IsOptional()
    @IsHexColor({ message: 'Mã màu phải là định dạng hex hợp lệ' })
    @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
        message: 'Mã màu phải có định dạng hex 3 hoặc 6 ký tự kèm dấu # (ví dụ: #fff hoặc #ffffff)',
    })
    color?: string;
}
