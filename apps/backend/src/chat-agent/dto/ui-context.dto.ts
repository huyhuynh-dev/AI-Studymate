import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class WorkspaceLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  pathname?: string;

  @IsIn(['home', 'subject', 'conversation', 'profile'])
  pageType!: 'home' | 'subject' | 'conversation' | 'profile';

  @IsOptional()
  @IsUUID('4')
  subjectId?: string | null;

  @IsOptional()
  @IsUUID('4')
  conversationId?: string | null;

  @IsOptional()
  @IsIn(['documents', 'summary', 'flashcard', 'quiz', 'analytics'])
  activeTab?:
    | 'documents'
    | 'summary'
    | 'flashcard'
    | 'quiz'
    | 'analytics'
    | null;

  @IsOptional()
  @IsBoolean()
  isFocusMode?: boolean;
}

export class ViewingDocumentContextDto {
  @IsUUID('4')
  documentId!: string;

  @IsString()
  @MaxLength(500)
  fileName!: string;

  @IsIn(['pdf', 'word', 'text', 'image', 'legacy_doc'])
  viewerKind!: 'pdf' | 'word' | 'text' | 'image' | 'legacy_doc';

  @IsOptional()
  @IsInt()
  @Min(1)
  currentPage?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalPages?: number;

  @IsOptional()
  @IsIn(['tracked', 'direct'])
  wordChangeMode?: 'tracked' | 'direct';

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  selectedText?: string;
}

export class DocumentsTabContextDto {
  @IsIn(['list', 'viewer'])
  viewMode!: 'list' | 'viewer';

  @IsIn(['all', 'pdf', 'image'])
  filterType!: 'all' | 'pdf' | 'image';

  @IsInt()
  @Min(0)
  totalCount!: number;

  @IsInt()
  @Min(0)
  visibleCount!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ViewingDocumentContextDto)
  viewingDocument?: ViewingDocumentContextDto | null;
}

export class ActiveSummaryContextDto {
  @IsUUID('4')
  summaryId!: string;

  @IsString()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  selectedText?: string;
}

export class SummaryTabContextDto {
  @IsIn(['list', 'detail'])
  viewMode!: 'list' | 'detail';

  @IsInt()
  @Min(0)
  totalCount!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ActiveSummaryContextDto)
  activeSummary?: ActiveSummaryContextDto | null;
}

export class ActiveDeckContextDto {
  @IsUUID('4')
  deckId!: string;

  @IsString()
  @MaxLength(300)
  deckName!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalCards?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  dueToday?: number;
}

export class FlashcardStudyContextDto {
  @IsIn(['due', 'extra'])
  mode!: 'due' | 'extra';

  @IsInt()
  @Min(0)
  progress!: number;

  @IsInt()
  @Min(0)
  remaining!: number;

  @IsOptional()
  @IsUUID('4')
  currentCardId?: string;

  @IsBoolean()
  isCardRevealed!: boolean;
}

export class FlashcardTabContextDto {
  @IsIn(['decks', 'detail', 'study'])
  viewMode!: 'decks' | 'detail' | 'study';

  @IsInt()
  @Min(0)
  totalDecksCount!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ActiveDeckContextDto)
  activeDeck?: ActiveDeckContextDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => FlashcardStudyContextDto)
  studyState?: FlashcardStudyContextDto | null;
}

export class ActiveQuizContextDto {
  @IsUUID('4')
  quizId!: string;

  @IsString()
  @MaxLength(300)
  title!: string;
}

export class ActiveQuizAttemptContextDto {
  @IsUUID('4')
  attemptId!: string;

  @IsOptional()
  @IsIn(['exam', 'practice'])
  mode?: 'exam' | 'practice';

  @IsOptional()
  @IsInt()
  @Min(1)
  currentQuestionIndex?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalQuestions?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  answeredCount?: number;

  @IsOptional()
  @IsIn(['all', 'incorrect', 'partial', 'correct', 'essay'])
  resultFilter?: 'all' | 'incorrect' | 'partial' | 'correct' | 'essay';
}

export class QuizTabContextDto {
  @IsIn(['list', 'detail', 'builder', 'taking', 'grading', 'result'])
  viewMode!: 'list' | 'detail' | 'builder' | 'taking' | 'grading' | 'result';

  @IsInt()
  @Min(0)
  totalQuizzesCount!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ActiveQuizContextDto)
  activeQuiz?: ActiveQuizContextDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ActiveQuizAttemptContextDto)
  activeAttempt?: ActiveQuizAttemptContextDto | null;
}

export class AnalyticsTabContextDto {
  @IsInt()
  @Min(1)
  @Max(365)
  windowDays!: number;

  @IsOptional()
  @IsBoolean()
  advancedOpen?: boolean;
}

export class SidePanelContextDto {
  @IsUUID('4')
  documentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fileName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageNo?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  citationId?: string;
}

export class WorkspaceUiContextDto {
  @IsInt()
  @IsIn([1])
  schemaVersion!: 1;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  capturedAt?: string;

  @ValidateNested()
  @Type(() => WorkspaceLocationDto)
  location!: WorkspaceLocationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentsTabContextDto)
  documents?: DocumentsTabContextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SummaryTabContextDto)
  summary?: SummaryTabContextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FlashcardTabContextDto)
  flashcard?: FlashcardTabContextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuizTabContextDto)
  quiz?: QuizTabContextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnalyticsTabContextDto)
  analytics?: AnalyticsTabContextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SidePanelContextDto)
  sidePanel?: SidePanelContextDto | null;
}
