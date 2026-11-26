import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { IsStrongAppPassword } from '../validators/password-policy.js';

export class RegisterDto {
    @IsString()
    @IsNotEmpty()
    readonly name: string;

    @IsEmail()
    @IsNotEmpty()
    readonly email: string;

    @IsString()
    @IsStrongAppPassword()
    readonly password: string;
}
