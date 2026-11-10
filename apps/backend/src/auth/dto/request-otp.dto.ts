import { IsEmail, IsNotEmpty } from 'class-validator';

export class RequestOtpDto {
    @IsNotEmpty({ message: 'Email không được để trống' })
    @IsEmail({}, { message: 'Định dạng email không hợp lệ' })
    email: string;
}