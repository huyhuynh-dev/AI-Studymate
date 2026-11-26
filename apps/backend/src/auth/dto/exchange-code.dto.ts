import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ExchangeCodeDto {
    @IsNotEmpty({ message: 'Auth code không được để trống' })
    @IsString({ message: 'Auth code phải là chuỗi' })
    readonly authCode: string;

    @IsOptional()
    @IsBoolean()
    readonly rememberMe?: boolean;
}
