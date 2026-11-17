import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class AnalyticsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'tzOffsetMinutes phải là số nguyên (phút lệch UTC)' })
  @Min(-720)
  @Max(840)
  tzOffsetMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'windowDays phải là số nguyên từ 7 đến 90 ngày' })
  @Min(7)
  @Max(90)
  windowDays?: number;
}
