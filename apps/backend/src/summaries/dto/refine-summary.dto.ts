import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RefineSummaryDto {
    @IsNotEmpty({ message: 'Chỉ dẫn tinh chỉnh không được để trống' })
    @IsString()
    @MinLength(2, { message: 'Chỉ dẫn tinh chỉnh phải có ít nhất 2 ký tự' })
    instruction: string;
}
