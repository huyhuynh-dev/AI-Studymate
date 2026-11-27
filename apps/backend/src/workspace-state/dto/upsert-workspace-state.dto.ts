import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  MAX_WORKSPACE_PAGE,
  MAX_WORKSPACE_TAB_LENGTH,
} from '../domain/workspace-state.types.js';

export class WorkspaceDocumentPointerDto {
  @IsUUID('4', { message: 'docId phải là UUID hợp lệ' })
  docId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page phải là số nguyên' })
  @Min(1, { message: 'page tối thiểu là 1' })
  @Max(MAX_WORKSPACE_PAGE, {
    message: `page tối đa là ${MAX_WORKSPACE_PAGE}`,
  })
  page?: number;
}

export class WorkspaceLocationDto {
  @IsOptional()
  @IsUUID('4', { message: 'subjectId phải là UUID hợp lệ' })
  subjectId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'conversationId phải là UUID hợp lệ' })
  conversationId?: string;

  @IsOptional()
  @IsString({ message: 'tab phải là chuỗi ký tự' })
  @MinLength(1, { message: 'tab không được rỗng' })
  @MaxLength(MAX_WORKSPACE_TAB_LENGTH, { message: 'tab quá dài' })
  tab?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkspaceDocumentPointerDto)
  document?: WorkspaceDocumentPointerDto;

  @IsOptional()
  @IsUUID('4', { message: 'summaryId phải là UUID hợp lệ' })
  summaryId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'deckId phải là UUID hợp lệ' })
  deckId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'quizId phải là UUID hợp lệ' })
  quizId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'chatSessionId phải là UUID hợp lệ' })
  chatSessionId?: string;
}

export class WorkspaceLayoutDto {
  @IsBoolean({ message: 'leftSidebarCollapsed phải là boolean' })
  leftSidebarCollapsed!: boolean;

  @IsBoolean({ message: 'rightSidebarCollapsed phải là boolean' })
  rightSidebarCollapsed!: boolean;
}

export class UpsertWorkspaceStateDto {
  @IsString({ message: 'sourceId phải là chuỗi ký tự' })
  @MinLength(8, { message: 'sourceId tối thiểu 8 ký tự' })
  @MaxLength(64, { message: 'sourceId tối đa 64 ký tự' })
  sourceId!: string;

  @Type(() => Number)
  @IsInt({ message: 'seq phải là số nguyên' })
  @Min(1, { message: 'seq tối thiểu là 1' })
  @Max(2_147_483_647, { message: 'seq vượt quá giới hạn số nguyên 32-bit' })
  seq!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkspaceLocationDto)
  location?: WorkspaceLocationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkspaceLayoutDto)
  layout?: WorkspaceLayoutDto;
}
