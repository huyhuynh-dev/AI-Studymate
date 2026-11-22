import { IsInt, IsOptional, Min } from 'class-validator';

export class OverwriteVersionDto {
    @IsOptional()
    @IsInt({ message: 'expectedVersion phải là số nguyên dương' })
    @Min(1, { message: 'expectedVersion phải lớn hơn hoặc bằng 1' })
    expectedVersion?: number;
}
