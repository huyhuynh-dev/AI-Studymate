export type EvalStoryId =
  | 'KB1'
  | 'KB2'
  | 'KB3'
  | 'KB4'
  | 'KB5'
  | 'KB6'
  | 'KB7'
  | 'KB8'
  | 'KB9'
  | 'KB10'
  | 'SAFETY';

export interface EvalToolInvocation {
  toolName: string;
  input: Record<string, unknown>;
  expectedRiskTier?: 'tier_0' | 'tier_1' | 'tier_2';
  expectApprovalGate?: boolean;
}

export interface TrajectoryEvalCase {
  id: string;
  storyId: EvalStoryId;
  title: string;
  userPrompt: string;
  maxExpectedSteps: number;
  hasActiveWordDocument?: boolean;
  expectedTools: string[];
  simulatedCalls: EvalToolInvocation[];
  policyCheck: {
    kind:
      | 'tool_budget_only'
      | 'risk_gate'
      | 'clarification_ask'
      | 'clarification_direct_ui'
      | 'clarification_anti_repeat'
      | 'prefix_cache_invariance'
      | 'context_clearing'
      | 'exam_guard'
      | 'flashcard_guard'
      | 'job_checkpointing';
    params?: Record<string, unknown>;
  };
}

export interface CaseEvalResult {
  id: string;
  storyId: EvalStoryId;
  title: string;
  passed: boolean;
  toolSelectionF1: number;
  argSchemaAccuracy: number;
  policyCompliance: number;
  stepEfficiency: number;
  failureReasons: string[];
}

export interface CategoryEvalMetrics {
  storyId: EvalStoryId;
  totalCases: number;
  passedCases: number;
  passRate: number;
  avgToolF1: number;
  avgArgAccuracy: number;
  avgPolicyCompliance: number;
}

export interface AgentEvalReport {
  generatedAt: string;
  mode: 'deterministic' | 'live';
  promptVersion: string;
  totalCases: number;
  passedCases: number;
  passRate: number;
  avgToolF1: number;
  avgArgAccuracy: number;
  avgPolicyCompliance: number;
  avgStepEfficiency: number;
  byStory: CategoryEvalMetrics[];
  cases: CaseEvalResult[];
}
