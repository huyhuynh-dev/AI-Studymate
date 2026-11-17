import { IsEmail, IsOptional, IsString } from 'class-validator';

export class DeleteAccountDto {
  @IsOptional()
  @IsString({ message: 'Mật khẩu xác nhận phải là chuỗi ký tự' })
  currentPassword?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Địa chỉ email xác nhận không hợp lệ' })
  confirmEmail?: string;
}
