import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_AVATAR_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export class RequestAvatarUploadDto {
  @IsNotEmpty({ message: 'Tên tệp ảnh không được để trống' })
  @IsString({ message: 'Tên tệp ảnh phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Tên tệp ảnh quá dài' })
  fileName: string;

  @IsNotEmpty({ message: 'Định dạng MIME không được để trống' })
  @IsIn(ALLOWED_AVATAR_MIME_TYPES, {
    message: 'Chỉ hỗ trợ ảnh định dạng JPG, PNG, WEBP hoặc GIF',
  })
  mimeType: string;

  @IsInt({ message: 'Dung lượng tệp phải là số nguyên (bytes)' })
  @Min(1, { message: 'Dung lượng tệp không hợp lệ' })
  @Max(AVATAR_MAX_SIZE_BYTES, {
    message: 'Ảnh đại diện không được vượt quá 5MB',
  })
  fileSize: number;
}
