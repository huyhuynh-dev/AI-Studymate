import { IsIn, IsNotEmpty, IsNumber, IsString, IsUUID, Max, Min } from 'class-validator';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from './init-upload.dto.js';

export class CompleteUploadDto {
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

    @IsString({ message: 'storageKey phải là chuỗi ký tự' })
    @IsNotEmpty({ message: 'storageKey không được để trống' })
    storageKey: string;
}
