import {
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { IsStrongAppPassword } from '../../auth/validators/password-policy.js';

export class ChangePasswordDto {
  @IsOptional()
  @IsString({ message: 'Mật khẩu hiện tại phải là chuỗi ký tự' })
  currentPassword?: string;

  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  @IsString({ message: 'Mật khẩu mới phải là chuỗi ký tự' })
  @IsStrongAppPassword()
  newPassword: string;
}
