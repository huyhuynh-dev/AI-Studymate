import { IsArray } from 'class-validator';
import type { UIMessage } from 'ai';

export class ChatStreamDto {
    @IsArray()
    messages: UIMessage[];
}
