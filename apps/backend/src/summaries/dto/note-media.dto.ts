import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from 'class-validator';
import {
    NOTE_MEDIA_KINDS,
    NOTE_MEDIA_MAX_UPLOAD_BYTES,
    type NoteMediaKind,
} from '../note-media.constants.js';

export class InitNoteMediaUploadDto {
    @IsString({ message: 'fileName phải là chuỗi ký tự' })
    @IsNotEmpty({ message: 'fileName không được để trống' })
    @MaxLength(255, { message: 'Tên tệp không được vượt quá 255 ký tự' })
    fileName: string;

    @IsInt({ message: 'fileSize phải là số nguyên bytes' })
    @Min(1, { message: 'fileSize phải lớn hơn 0 bytes' })
    @Max(NOTE_MEDIA_MAX_UPLOAD_BYTES, {
        message: 'Kích thước tệp vượt quá giới hạn tối đa cho phép (50MB)',
    })
    fileSize: number;

    @IsString({ message: 'mimeType phải là chuỗi ký tự' })
    @IsNotEmpty({ message: 'mimeType không được để trống' })
    @MaxLength(150, { message: 'mimeType không hợp lệ' })
    mimeType: string;

    @IsOptional()
    @IsIn(NOTE_MEDIA_KINDS, {
        message: 'mediaKind phải thuộc image, video, audio hoặc file',
    })
    mediaKind?: NoteMediaKind;
}

export class CompleteNoteMediaUploadDto {
    @IsString({ message: 'storageKey phải là chuỗi ký tự' })
    @IsNotEmpty({ message: 'storageKey không được để trống' })
    @MaxLength(1000, { message: 'storageKey vượt quá độ dài cho phép' })
    storageKey: string;

    @IsString({ message: 'fileName phải là chuỗi ký tự' })
    @IsNotEmpty({ message: 'fileName không được để trống' })
    @MaxLength(255, { message: 'fileName không được vượt quá 255 ký tự' })
    fileName: string;

    @IsOptional()
    @IsIn(NOTE_MEDIA_KINDS, {
        message: 'mediaKind phải thuộc image, video, audio hoặc file',
    })
    mediaKind?: NoteMediaKind;
}

export class ResolveNoteMediaUrlsDto {
    @IsArray({ message: 'mediaUris phải là một mảng' })
    @ArrayMinSize(1, { message: 'Danh sách mediaUris không được rỗng' })
    @ArrayMaxSize(50, { message: 'Chỉ được phép resolve tối đa 50 URI mỗi lần' })
    @IsString({ each: true, message: 'Mỗi phần tử trong mediaUris phải là chuỗi' })
    mediaUris: string[];

    @IsOptional()
    @IsBoolean({ message: 'download phải là giá trị boolean' })
    download?: boolean;
}
