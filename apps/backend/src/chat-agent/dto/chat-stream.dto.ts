import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import type { UIMessage } from 'ai';

export class ActiveWordContextDto {
  @IsUUID('4', { message: 'documentId phải là UUID hợp lệ' })
  documentId!: string;

  @IsOptional()
  @IsIn(['tracked', 'direct'])
  changeMode?: 'tracked' | 'direct';

  @IsOptional()
  @IsString()
  selectedText?: string;
}

export class ChatStreamDto {
  @IsArray()
  messages!: UIMessage[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachedDocumentIds?: string[];

  @IsOptional()
  @IsString()
  modelId?: string;

  @IsOptional()
  @IsString()
  effort?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ActiveWordContextDto)
  activeWordContext?: ActiveWordContextDto;
}
