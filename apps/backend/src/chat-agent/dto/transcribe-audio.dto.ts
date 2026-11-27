import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class TranscribeAudioDto {
  @IsString()
  @IsNotEmpty({ message: 'Dữ liệu âm thanh không được để trống' })
  @MaxLength(14_000_000, {
    message: 'Dữ liệu âm thanh vượt quá kích thước cho phép',
  })
  audioBase64: string;

  @IsString()
  @IsNotEmpty({ message: 'Định dạng âm thanh (mimeType) là bắt buộc' })
  @MaxLength(100)
  mimeType: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/i, {
    message: 'Mã ngôn ngữ không hợp lệ',
  })
  language?: string;
}
