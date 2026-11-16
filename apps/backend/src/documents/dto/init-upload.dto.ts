import { IsIn, IsNotEmpty, IsNumber, IsString, IsUUID, Max, Min } from 'class-validator';

export const ALLOWED_MIME_TYPES = [
    // PDF
    'application/pdf',
    // Word (.doc, .docx)
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // Excel (.xls, .xlsx)
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // PowerPoint (.ppt, .pptx)
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // CSV (.csv)
    'text/csv',
    'application/csv',
    // Markdown (.md)
    'text/markdown',
    'text/x-markdown',
    // Text (.txt)
    'text/plain',
    // Hình ảnh (.jpg, .jpeg, .png, .webp)
    'image/jpeg',
    'image/jpg',
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
        message:
            'Định dạng tệp không được hỗ trợ. Chỉ chấp nhận PDF, Word, Excel, PowerPoint, CSV, Markdown, TXT, JPEG, PNG, WEBP',
    })
    mimeType: string;
}
