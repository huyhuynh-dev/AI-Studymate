import { IsIn, IsNotEmpty, IsNumber, IsString, IsUUID, Max, Min } from 'class-validator';

export const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
] as const;

export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export class InitUploadDto {
    @IsUUID('4', { message: 'conversationId phải là UUID hợp lệ' })
    @IsNotEmpty({ message: 'conversationId không được để trống' })
    conversationId: string;

    @IsString({ message: 'fileName phải là chuỗi ký tự' })
    @IsNotEmpty({ message: 'fileName không được để trống' })
    fileName: string;

    @IsNumber({}, { message: 'fileSize phải là số nguyên bytes' })
    @Min(1, { message: 'fileSize phải lớn hơn 0 bytes' })
    @Max(MAX_FILE_SIZE_BYTES, { message: 'Kích thước tệp vượt quá giới hạn tối đa cho phép (50MB)' })
    fileSize: number;

    @IsString({ message: 'mimeType phải là chuỗi ký tự' })
    @IsIn(ALLOWED_MIME_TYPES, {
        message: 'Định dạng tệp không được hỗ trợ. Chỉ chấp nhận PDF, JPEG, PNG, WEBP',
    })
    mimeType: string;
}
