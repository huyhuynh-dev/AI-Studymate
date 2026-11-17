import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ChangePasswordDto {
  @IsOptional()
  @IsString({ message: 'Mật khẩu hiện tại phải là chuỗi ký tự' })
  currentPassword?: string;

  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  @IsString({ message: 'Mật khẩu mới phải là chuỗi ký tự' })
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
  @MaxLength(128, { message: 'Mật khẩu mới không được vượt quá 128 ký tự' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Mật khẩu mới phải bao gồm cả chữ cái và chữ số',
  })
  newPassword: string;
}
