import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Giới hạn kích thước base64 tương đương ~20MB nhị phân DOCX.
 */
const MAX_AGENT_SNAPSHOT_BASE64_CHARS = 28 * 1024 * 1024;

export class StageAgentSnapshotDto {
  @IsString({ message: 'Dữ liệu snapshot phải là chuỗi base64 hợp lệ' })
  @IsNotEmpty({ message: 'Dữ liệu snapshot không được để trống' })
  @MaxLength(MAX_AGENT_SNAPSHOT_BASE64_CHARS, {
    message: 'Kích thước tệp nháp vượt quá giới hạn cho phép (20MB)',
  })
  base64!: string;
}
