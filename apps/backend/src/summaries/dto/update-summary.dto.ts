import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateSummaryDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsArray({ message: 'content_json phải là mảng các khối BlockNote' })
    content_json?: any[];
}
