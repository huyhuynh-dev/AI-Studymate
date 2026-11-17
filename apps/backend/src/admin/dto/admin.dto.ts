import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminAiUsageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'windowDays phải là số nguyên' })
  @Min(1)
  @Max(365)
  windowDays?: number;
}

export class AdminUsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class UpdateAdminUserStatusDto {
  @IsOptional()
  @IsBoolean({ message: 'isActive phải là kiểu boolean' })
  isActive?: boolean;

  @IsOptional()
  @IsIn(['user', 'admin'], {
    message: "role chỉ nhận giá trị 'user' hoặc 'admin'",
  })
  role?: 'user' | 'admin';
}
