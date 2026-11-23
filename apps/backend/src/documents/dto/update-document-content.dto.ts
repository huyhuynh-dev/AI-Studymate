import { IsInt, IsString, Min } from 'class-validator';

export class UpdateDocumentContentDto {
  @IsString({ message: 'content phải là chuỗi văn bản' })
  content: string;

  @IsInt({ message: 'expectedVersion phải là số nguyên dương' })
  @Min(1, { message: 'expectedVersion tối thiểu là 1' })
  expectedVersion: number;
}
