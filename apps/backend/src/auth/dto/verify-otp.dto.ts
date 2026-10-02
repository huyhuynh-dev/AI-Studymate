import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
    @IsNotEmpty({ message: 'Email không được để trống' })
    @IsEmail({}, { message: 'Định dạng email không hợp lệ' })
    email: string;

    @IsNotEmpty({ message: 'OTP không được để trống' })
    @IsString()
    @Length(6, 6, { message: 'OTP phải bao gồm đúng 6 ký tự' })
    otp: string;
}