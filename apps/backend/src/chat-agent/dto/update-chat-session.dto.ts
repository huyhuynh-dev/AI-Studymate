import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateChatSessionDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    title: string;
}
