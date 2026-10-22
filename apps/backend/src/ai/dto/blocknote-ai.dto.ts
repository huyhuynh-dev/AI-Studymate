import { ArrayMaxSize, IsArray, IsObject, IsOptional, IsString } from 'class-validator';
import type { UIMessage } from 'ai';
import type { BlocknoteToolDefinitions } from '../blocknote-ai.service.js';

export class BlocknoteAiDto {
    @IsOptional()
    @IsString()
    id?: string;

    @IsOptional()
    @IsString()
    trigger?: string;

    @IsArray()
    @ArrayMaxSize(50, { message: 'Số lượng tin nhắn vượt quá giới hạn cho phép (tối đa 50)' })
    messages!: UIMessage[];

    @IsObject()
    toolDefinitions!: BlocknoteToolDefinitions;
}
