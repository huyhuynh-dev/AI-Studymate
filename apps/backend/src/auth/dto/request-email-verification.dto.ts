import { IsEmail, IsNotEmpty } from 'class-validator';

export class RequestEmailVerificationDto {
    @IsNotEmpty({ message: 'Email is required' })
    @IsEmail({}, { message: 'Email must be a valid email address' })
    email: string;
}