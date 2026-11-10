import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GenerateSuggestionsDto {
  @IsString()
  @IsNotEmpty()
  lastAssistantResponse: string;

  @IsOptional()
  @IsString()
  lastUserQuestion?: string;
}
