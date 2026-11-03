import { IsArray, IsOptional, IsString } from 'class-validator';
import type { UIMessage } from 'ai';

export class ChatStreamDto {
  @IsArray()
  messages: UIMessage[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachedDocumentIds?: string[];
}
