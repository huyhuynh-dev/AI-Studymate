import type {
  AIGenerateOptions, AttemptAnswer, AttemptConfig, DeckGenerateOptions, EvaluationStatus,
  FlashcardTarget, Quiz, QuizAttempt, QuizDraft,
} from "../types";

/**
 * Hợp đồng giữa giao diện QuizTab và Backend.
 * Triển khai thật: viết một object thoả interface này (axios/SWR/proxy của dự án)
 * rồi truyền vào <QuizTab api={...} />. Xem HuongDanTrienKhai.md (mục 3).
 */
export interface QuizApi {
  listQuizzes(conversationId: string): Promise<Quiz[]>;
  listAttempts(quizId: string): Promise<QuizAttempt[]>;
  createQuiz(conversationId: string, draft: QuizDraft): Promise<Quiz>;
  updateQuiz(quizId: string, draft: QuizDraft): Promise<Quiz>;
  deleteQuiz(quizId: string): Promise<void>;
  generateWithAI(conversationId: string, opts: AIGenerateOptions): Promise<Quiz>;
  generateFromDeck(conversationId: string, opts: DeckGenerateOptions): Promise<Quiz>;
  /** Tạo lượt làm bài. config gồm thứ tự câu/đáp án đã được đảo trộn phía client. */
  startAttempt(quizId: string, config: AttemptConfig): Promise<QuizAttempt>;
  /** Lưu nháp 1 câu (UPSERT theo attempt_id + question_id) */
  saveAnswer(attemptId: string, answer: AttemptAnswer): Promise<void>;
  saveProgress(attemptId: string, timeSpentSec: number): Promise<void>;
  /** Nộp bài: backend chấm khách quan ngay + gọi AI chấm tự luận. Có thể mất vài giây. */
  submitAttempt(attemptId: string, timeSpentSec: number, answers: AttemptAnswer[]): Promise<QuizAttempt>;
  /** Người học tự điều chỉnh điểm câu tự luận */
  overrideEvaluation(attemptId: string, questionId: string, status: Exclude<EvaluationStatus, "pending">): Promise<QuizAttempt>;
  convertToFlashcards(attemptId: string, questionIds: string[], target: FlashcardTarget): Promise<{ deckId: string; created: number }>;
}
