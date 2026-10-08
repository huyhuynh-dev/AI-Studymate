import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateConversationDto {
    @IsUUID()
    @IsNotEmpty()
    subject_id: string;

    @IsString()
    @IsNotEmpty()
    title: string;
}
