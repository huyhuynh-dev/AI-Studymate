import type { SourceReference } from './source-ref';

export type AnalyticsBloomLevel = 'remember' | 'understand' | 'apply' | 'analyze';
export type MasteryStatus = 'unstudied' | 'weak' | 'developing' | 'mastered';
export type MetricStatusLabel =
  | 'good'
  | 'ok'
  | 'needs_work'
  | 'insufficient_data';
export type MasteryConfidence = 'low' | 'medium' | 'high';

export interface MetricWithContext {
  value: number | null;
  deltaVsPrev: number | null;
  sampleSize: number;
  minSampleSize: number;
  label: MetricStatusLabel;
  explanation: string;
}

export interface TodayPlanTask {
  id: string;
  order: number;
  actionType: StudyRecommendationActionType;
  title: string;
  subtitle: string;
  estimatedMinutes: number;
  actionLabel: string;
  payload: StudyRecommendationPayload;
}

export interface TodayStudyPlan {
  tasks: TodayPlanTask[];
  totalEstimatedMinutes: number;
  minutesDoneToday: number;
  dailyGoalMinutes: number;
  overdueCount: number;
  gentleCatchupSuggestion: string | null;
}

export interface ExamReadinessMetric extends MetricWithContext {
  examDate: string;
  targetScore: number;
  daysLeft: number;
  projectedScore: number | null;
  suggestedExtraMinutesPerDay: number | null;
  coverageRate: number;
}

export interface HeadlineMetrics {
  mastery: MetricWithContext & {
    sectionsMastered: number;
    sectionsStudied: number;
    sectionsTotal: number;
  };
  retention: MetricWithContext;
  habit: {
    daysStudiedThisWeek: number;
    weekDaysMask: boolean[];
    minutesThisWeek: number;
    minutesLastWeek: number;
    streakDays: number;
    studiedToday: boolean;
  };
  readiness: ExamReadinessMetric | null;
}

export interface AttentionItem {
  sectionKey: string;
  title: string;
  conversationId: string;
  conversationTitle?: string;
  documentId: string;
  fileName: string;
  startPage: number | null;
  endPage: number | null;
  masteryScore: number | null;
  status: MasteryStatus;
  confidence: MasteryConfidence;
  priorityScore: number;
  reasons: string[];
  primaryAction: {
    type: StudyRecommendationActionType;
    label: string;
    payload: StudyRecommendationPayload;
  };
  secondaryAction?: {
    type: 'open_pdf';
    label: string;
    payload: {
      documentId: string;
      fileName: string;
      pageNo: number;
      conversationId: string;
    };
  };
}

export interface CoachingInsight {
  ruleId: string;
  tone: 'positive' | 'focus' | 'info';
  message: string;
}

export interface ProgressBucketPoint {
  bucketKey: string;
  label: string;
  minutesStudied: number;
  retentionRate: number | null;
  reviewCount: number;
}

export interface QuizRetakeGainItem {
  quizId: string;
  quizTitle: string;
  conversationId: string;
  attemptsCount: number;
  firstScorePct: number;
  latestScorePct: number;
  gainPct: number;
}

export interface ProgressTrends {
  windowDays: number;
  buckets: ProgressBucketPoint[];
  totalMinutesInWindow: number;
  avgRetentionInWindow: number | null;
  retentionSampleInWindow: number;
  quizRetakeGains: QuizRetakeGainItem[];
  latestQuizAvgPct: number | null;
}

export interface DocumentSectionTile {
  index: number;
  text: string;
  status: MasteryStatus;
  masteryScore: number | null;
  startPage: number | null;
  confidence: MasteryConfidence;
}

export interface AdvancedAnalyticsBreakdown {
  deckComposition: {
    newCount: number;
    learningCount: number;
    youngCount: number;
    matureCount: number;
  };
  ratingDistribution: {
    again: number;
    hard: number;
    good: number;
    easy: number;
    total: number;
  };
  flaggedCorrectCount: number;
  flaggedIncorrectCount: number;
  questionTypeGap: {
    objectiveAvgPct: number | null;
    essayAvgPct: number | null;
  };
}

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
  confidence?: MasteryConfidence;
  sampleSize?: number;
  quizCorrect: number;
  quizTotal: number;
  cardTotal: number;
  cardReviewed: number;
  cardMastered: number;
  leechCount: number;
  missingPoints: string[];
  chunkIds: string[];
  bboxes?: unknown[];
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
  conversationId?: string;
  fileName: string;
  pageCount: number | null;
  overallMasteryScore: number | null;
  overallStatus: MasteryStatus;
  totalSections: number;
  studiedSectionsCount: number;
  weakSectionsCount: number;
  masteredSectionsCount: number;
  sectionTiles?: DocumentSectionTile[];
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
  missingPoints?: string[];
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
  dailyGoalMinutes: number;
  examDate: string | null;
  targetScore: number | null;
  srsOverview: SrsOverviewStats;
  workloadForecast7Days: WorkloadForecastDay[];
  leechCards: LeechCardItem[];
  quizPerformance: QuizPerformanceSummary;
  bloomMastery: BloomMasterySummary;
  missingPointsClusters: MissingPointCluster[];
  weakTopics: WeakTopicItem[];
  documentMasterySummaries: DocumentMasterySummary[];
  recommendations: StudyRecommendation[];
  todayPlan: TodayStudyPlan;
  headline: HeadlineMetrics;
  attentionItems: AttentionItem[];
  insights: CoachingInsight[];
  progress: ProgressTrends;
  advanced: AdvancedAnalyticsBreakdown;
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
  dailyGoalMinutes: number;
  examDate: string | null;
  targetScore: number | null;
  srsOverview: SrsOverviewStats;
  workloadForecast7Days: WorkloadForecastDay[];
  leechCards: LeechCardItem[];
  quizPerformance: QuizPerformanceSummary;
  bloomMastery: BloomMasterySummary;
  missingPointsClusters: MissingPointCluster[];
  topWeakTopics: WeakTopicItem[];
  documentMasterySummaries: DocumentMasterySummary[];
  conversationSummaries: SubjectConversationSummary[];
  recommendations: StudyRecommendation[];
  todayPlan: TodayStudyPlan;
  headline: HeadlineMetrics;
  attentionItems: AttentionItem[];
  insights: CoachingInsight[];
  progress: ProgressTrends;
  advanced: AdvancedAnalyticsBreakdown;
}
