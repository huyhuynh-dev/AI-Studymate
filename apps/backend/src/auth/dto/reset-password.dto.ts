import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IsStrongAppPassword } from '../validators/password-policy.js';

export class ResetPasswordDto {
    @IsNotEmpty({ message: 'Reset token không được để trống' })
    @IsString({ message: 'Reset token phải là chuỗi' })
    readonly reset_token: string;

    @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
    @IsString({ message: 'Mật khẩu mới phải là chuỗi' })
    @IsStrongAppPassword()
    readonly new_password: string;

    @IsOptional()
    @IsBoolean({ message: 'logoutAll phải là giá trị boolean' })
    readonly logoutAll?: boolean;
}
