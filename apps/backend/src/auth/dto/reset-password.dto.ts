import { IsBoolean, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
    @IsNotEmpty({ message: 'Reset token không được để trống' })
    @IsString({ message: 'Reset token phải là chuỗi' })
    readonly reset_token: string;

    @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
    @IsString({ message: 'Mật khẩu mới phải là chuỗi' })
    @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
    readonly new_password: string;

    @IsOptional()
    @IsBoolean({ message: 'logoutAll phải là giá trị boolean' })
    readonly logoutAll?: boolean;
}
