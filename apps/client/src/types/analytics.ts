import type { SourceReference } from './source-ref';

export type AnalyticsBloomLevel = 'remember' | 'understand' | 'apply' | 'analyze';
export type MasteryStatus = 'unstudied' | 'weak' | 'developing' | 'mastered';

export interface SrsOverviewStats {
  totalCards: number;
  dueNowCount: number;
  newCount: number;
  learningCount: number;
  reviewCount: number;
  relearningCount: number;
  masteredCount: number;
  retentionRate: number | null;
  matureRetentionRate: number | null;
  totalReviewsInWindow: number;
  againCountInWindow: number;
  avgResponseTimeMs: number | null;
  studyStreakDays: number;
  longestStreakDays: number;
  studiedToday: boolean;
  activeDaysLast30: number;
}

export interface WorkloadForecastDay {
  date: string;
  label: string;
  isToday: boolean;
  dueCount: number;
  newCount: number;
  estimatedMinutes: number;
}

export interface LeechCardItem {
  id: string;
  deckId: string;
  deckName: string;
  conversationId: string;
  frontText: string;
  easeFactor: number;
  state: string;
  againCount: number;
  sourceRefs: SourceReference[];
}

export interface BloomMasteryItem {
  level: AnalyticsBloomLevel;
  totalAnswered: number;
  correctCount: number;
  partialCount: number;
  incorrectCount: number;
  accuracyRate: number | null;
}

export interface BloomMasterySummary {
  levels: BloomMasteryItem[];
  untaggedCount: number;
}

export interface QuizScoreTrendItem {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  conversationId: string;
  scorePct: number;
  completedAt: string;
}

export interface QuizPerformanceSummary {
  totalSubmittedAttempts: number;
  avgScorePct: number | null;
  recentScores: QuizScoreTrendItem[];
}

export interface MissingPointCluster {
  point: string;
  frequency: number;
  bloomLevels: AnalyticsBloomLevel[];
  sampleQuestionText: string;
  sourceRefs: SourceReference[];
}

export interface TocMasterySection {
  index: number;
  text: string;
  level: number;
  startPage: number | null;
  endPage: number | null;
  status: MasteryStatus;
  masteryScore: number | null;
  quizCorrect: number;
  quizTotal: number;
  cardTotal: number;
  cardReviewed: number;
  cardMastered: number;
  leechCount: number;
  missingPoints: string[];
  chunkIds: string[];
}

export interface DocumentMasteryResponse {
  documentId: string;
  conversationId: string;
  fileName: string;
  pageCount: number | null;
  overallMasteryScore: number | null;
  overallStatus: MasteryStatus;
  totalSections: number;
  studiedSectionsCount: number;
  weakSectionsCount: number;
  developingSectionsCount: number;
  masteredSectionsCount: number;
  sections: TocMasterySection[];
}

export interface DocumentMasterySummary {
  documentId: string;
  fileName: string;
  pageCount: number | null;
  overallMasteryScore: number | null;
  overallStatus: MasteryStatus;
  totalSections: number;
  studiedSectionsCount: number;
  weakSectionsCount: number;
  masteredSectionsCount: number;
}

export interface WeakTopicItem {
  topic: string;
  conversationId: string;
  conversationTitle?: string;
  documentId: string;
  fileName: string;
  startPage: number | null;
  endPage: number | null;
  masteryScore: number | null;
  status: MasteryStatus;
  quizCorrect: number;
  quizTotal: number;
  leechCount: number;
  missingPointCount: number;
  chunkIds: string[];
}

export type StudyRecommendationActionType =
  | 'review_due_cards'
  | 'targeted_quiz_weak_chunk'
  | 'remediate_leech_cards'
  | 'address_bloom_gap'
  | 'read_unstudied_section';

export interface StudyRecommendationPayload {
  conversationId: string;
  subjectId?: string;
  deckId?: string;
  documentId?: string;
  pageNo?: number;
  chunkIds?: string[];
  flashcardIds?: string[];
  bloomPreset?: 'familiarize' | 'balanced' | 'exam_prep';
  sectionTitle?: string;
}

export interface StudyRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  actionType: StudyRecommendationActionType;
  title: string;
  reason: string;
  actionLabel: string;
  payload: StudyRecommendationPayload;
}

export interface ConversationAnalyticsResponse {
  conversationId: string;
  conversationTitle: string;
  subjectId: string;
  subjectName: string;
  generatedAt: string;
  windowDays: number;
  srsOverview: SrsOverviewStats;
  workloadForecast7Days: WorkloadForecastDay[];
  leechCards: LeechCardItem[];
  quizPerformance: QuizPerformanceSummary;
  bloomMastery: BloomMasterySummary;
  missingPointsClusters: MissingPointCluster[];
  weakTopics: WeakTopicItem[];
  documentMasterySummaries: DocumentMasterySummary[];
  recommendations: StudyRecommendation[];
}

export interface SubjectConversationSummary {
  conversationId: string;
  title: string;
  updatedAt: string;
  totalCards: number;
  dueNowCount: number;
  leechCount: number;
  quizAttemptCount: number;
  avgQuizScorePct: number | null;
  weakSectionsCount: number;
}

export interface SubjectAnalyticsResponse {
  subjectId: string;
  subjectName: string;
  color: string | null;
  generatedAt: string;
  windowDays: number;
  srsOverview: SrsOverviewStats;
  workloadForecast7Days: WorkloadForecastDay[];
  leechCards: LeechCardItem[];
  quizPerformance: QuizPerformanceSummary;
  bloomMastery: BloomMasterySummary;
  missingPointsClusters: MissingPointCluster[];
  topWeakTopics: WeakTopicItem[];
  conversationSummaries: SubjectConversationSummary[];
  recommendations: StudyRecommendation[];
}
