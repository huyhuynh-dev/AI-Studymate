import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Họ và tên phải là chuỗi ký tự' })
  @MinLength(2, { message: 'Họ và tên phải có ít nhất 2 ký tự' })
  @MaxLength(100, { message: 'Họ và tên không được vượt quá 100 ký tự' })
  name?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Định danh ảnh đại diện phải là chuỗi ký tự' })
  @MaxLength(480, { message: 'Định danh ảnh đại diện quá dài' })
  avatarStorageKey?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Mục tiêu học mỗi ngày phải là số nguyên (phút)' })
  @Min(5, { message: 'Mục tiêu học mỗi ngày tối thiểu là 5 phút' })
  @Max(240, { message: 'Mục tiêu học mỗi ngày tối đa là 240 phút' })
  dailyGoalMinutes?: number;
}
