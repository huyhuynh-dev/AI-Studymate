import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateChatSessionDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    title: string;
}
