/* Kiểu dữ liệu QuizTab — ánh xạ camelCase từ Quiz_DatabaseSchema.md */

export type QuestionType = "single_choice" | "multiple_choice" | "true_false" | "short_answer" | "essay";
export type AttemptStatus = "in_progress" | "grading" | "submitted";
export type EvaluationStatus = "pending" | "correct" | "partial" | "incorrect";
export type QuizSource = "ai" | "flashcard" | "manual";
export type Difficulty = "basic" | "applied" | "advanced";
export type FeedbackMode = "practice" | "exam";

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  type: QuestionType;
  orderIndex: number;
  /** HTML (TipTap) */
  text: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  points: number;
  /** single_choice | multiple_choice | true_false. true_false dùng id "true" / "false". */
  options?: QuizOption[] | null;
  /** short_answer: đáp án (nhiều đáp án chấp nhận cách nhau bởi dấu "|"). essay: bài viết mẫu (HTML). */
  sampleAnswer?: string | null;
  gradingCriteria: string[];
  /** HTML */
  explanation?: string | null;
}

export interface Quiz {
  id: string;
  conversationId: string;
  title: string;
  description?: string | null;
  timeLimitSec: number | null;
  sourceDeckId?: string | null;
  /** Tên bộ thẻ để hiển thị (join từ flashcard_decks) */
  sourceDeckName?: string | null;
  /** DB chưa có cột này — xem HuongDanTrienKhai.md (mục 6) */
  source: QuizSource;
  questions: QuizQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface AttemptAnswer {
  questionId: string;
  selectedOptionIds: string[];
  /** short_answer: text thuần. essay: HTML */
  textAnswer: string;
  isFlagged: boolean;
  evaluationStatus: EvaluationStatus;
  pointsEarned: number;
  matchedPoints: string[];
  missingPoints: string[];
  aiFeedback?: string | null;
}

export interface AttemptConfig {
  mode: FeedbackMode;
  timeLimitSec: number | null;
  questionOrder: string[];
  optionOrder: Record<string, string[]>;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  status: AttemptStatus;
  score: number;
  maxScore: number;
  timeSpentSec: number;
  startedAt: string;
  completedAt?: string | null;
  answers: Record<string, AttemptAnswer>;
  /** DB chưa lưu cấu hình lượt làm — nếu thiếu, UI dùng cấu hình mặc định */
  config?: AttemptConfig;
}

/* ---------- Dữ liệu vào/ra của lớp API ---------- */

export type QuestionDraft = Omit<QuizQuestion, "quizId" | "orderIndex">;

export interface QuizDraft {
  title: string;
  description?: string | null;
  timeLimitSec: number | null;
  questions: QuestionDraft[];
}

export interface TestSetup {
  mode: FeedbackMode;
  timeLimitSec: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  /** Chỉ làm lại một số câu (vd: câu sai / đúng một phần) */
  onlyQuestionIds?: string[];
}

export interface AIGenerateOptions {
  questionCount: number;
  types: QuestionType[];
  difficulty: Difficulty;
}

export interface DeckGenerateOptions {
  deckId: string;
  questionCount: number;
  types: QuestionType[];
}

export interface DeckOption {
  id: string;
  name: string;
  cardCount: number;
}

export interface FlashcardTarget {
  deckId?: string;
  newDeckName?: string;
}
