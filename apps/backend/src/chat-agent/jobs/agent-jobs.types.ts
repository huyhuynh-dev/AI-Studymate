export type AgentBackgroundJobType =
  | 'bulk_flashcards'
  | 'bulk_quiz'
  | 'deep_multi_doc_summary'
  | 'batch_study_workflow';

export type AgentBackgroundJobStatusType =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentJobStepLog {
  stepIndex: number;
  stepKey: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  finishedAt?: string;
  artifactId?: string;
  detail?: string;
  error?: string;
}

export interface AgentBackgroundJobPayload {
  documentIds?: string[];
  count?: number;
  deckName?: string;
  instructions?: string;
}

export interface AgentBackgroundJobResult {
  summary?: string;
  summaryId?: string;
  deckId?: string;
  quizId?: string;
  createdCount?: number;
}

export interface AgentBackgroundJobDto {
  id: string;
  userId: string;
  conversationId: string;
  chatSessionId: string | null;
  jobType: AgentBackgroundJobType;
  title: string;
  status: AgentBackgroundJobStatusType;
  progressPercent: number;
  totalSteps: number;
  completedSteps: number;
  stepLogs: AgentJobStepLog[];
  result: AgentBackgroundJobResult | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueAgentJobInput {
  userId: string;
  conversationId: string;
  chatSessionId?: string | null;
  jobType: AgentBackgroundJobType;
  title: string;
  payload: AgentBackgroundJobPayload;
}

export interface AgentBullMqJobData {
  jobId: string;
  userId: string;
  conversationId: string;
  jobType: AgentBackgroundJobType;
}
