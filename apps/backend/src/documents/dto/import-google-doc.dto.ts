import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ImportGoogleDocDto {
    @IsUUID('4', { message: 'conversationId phải là UUID hợp lệ' })
    @IsNotEmpty({ message: 'conversationId không được để trống' })
    conversationId: string;

    @IsString({ message: 'url phải là chuỗi ký tự' })
    @IsNotEmpty({ message: 'Đường dẫn Google Docs không được để trống' })
    @MaxLength(2048, { message: 'Đường dẫn Google Docs tối đa 2048 ký tự' })
    url: string;

    @IsOptional()
    @IsString({ message: 'fileName phải là chuỗi ký tự' })
    @MaxLength(240, { message: 'Tên tệp tối đa 240 ký tự' })
    fileName?: string;
}
