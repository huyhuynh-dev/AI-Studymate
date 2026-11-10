import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class GetDecksQueryDto {
    @IsOptional()
    @IsUUID()
    conversationId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    search?: string;
}

export class CreateDeckDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsUUID()
    @IsNotEmpty()
    conversationId: string;
}

export class UpdateDeckDto {
    @IsOptional()
    @IsString()
    @MaxLength(255)
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;
}
