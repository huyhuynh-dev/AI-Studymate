import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';
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
    messages!: UIMessage[];

    @IsObject()
    toolDefinitions!: BlocknoteToolDefinitions;
}
