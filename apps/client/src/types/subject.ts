export interface Subject {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSubjectDto {
  name: string;
  color?: string;
}

export interface UpdateSubjectDto {
  name?: string;
  color?: string;
}
