import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateManualNoteDto {
    @IsOptional()
    @IsString({ message: 'Tiêu đề ghi chú phải là chuỗi văn bản' })
    @MaxLength(255, { message: 'Tiêu đề ghi chú không được vượt quá 255 ký tự' })
    title?: string;

    @IsOptional()
    @IsArray({ message: 'content_json phải là mảng các khối BlockNote' })
    content_json?: unknown[];
}
