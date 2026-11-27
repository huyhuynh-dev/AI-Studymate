import type {
  AgentEvalReport,
  CaseEvalResult,
  CategoryEvalMetrics,
  EvalStoryId,
} from '../agent-evals.types.js';

export function computeToolSelectionF1(
  expectedTools: string[],
  actualTools: string[],
): number {
  const expectedSet = new Set(expectedTools);
  const actualSet = new Set(actualTools);

  if (expectedSet.size === 0 && actualSet.size === 0) {
    return 1;
  }
  if (expectedSet.size === 0 || actualSet.size === 0) {
    return 0;
  }

  let tp = 0;
  for (const t of actualSet) {
    if (expectedSet.has(t)) tp += 1;
  }
  const precision = tp / actualSet.size;
  const recall = tp / expectedSet.size;
  if (precision + recall === 0) return 0;
  return Number(((2 * precision * recall) / (precision + recall)).toFixed(4));
}

export function aggregateTrajectoryReport(params: {
  mode: 'deterministic' | 'live';
  promptVersion: string;
  cases: CaseEvalResult[];
}): AgentEvalReport {
  const { mode, promptVersion, cases } = params;
  const totalCases = cases.length;
  const passedCases = cases.filter((c) => c.passed).length;

  const avg = (getter: (c: CaseEvalResult) => number) =>
    totalCases === 0
      ? 0
      : Number(
          (cases.reduce((acc, c) => acc + getter(c), 0) / totalCases).toFixed(4),
        );

  const storyOrder: EvalStoryId[] = [
    'KB1',
    'KB2',
    'KB3',
    'KB4',
    'KB5',
    'KB6',
    'KB7',
    'KB8',
    'KB9',
    'KB10',
    'SAFETY',
  ];

  const byStory: CategoryEvalMetrics[] = [];
  for (const storyId of storyOrder) {
    const group = cases.filter((c) => c.storyId === storyId);
    if (group.length === 0) continue;
    const gPassed = group.filter((c) => c.passed).length;
    byStory.push({
      storyId,
      totalCases: group.length,
      passedCases: gPassed,
      passRate: Number((gPassed / group.length).toFixed(4)),
      avgToolF1: Number(
        (group.reduce((a, c) => a + c.toolSelectionF1, 0) / group.length).toFixed(4),
      ),
      avgArgAccuracy: Number(
        (group.reduce((a, c) => a + c.argSchemaAccuracy, 0) / group.length).toFixed(4),
      ),
      avgPolicyCompliance: Number(
        (
          group.reduce((a, c) => a + c.policyCompliance, 0) / group.length
        ).toFixed(4),
      ),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    mode,
    promptVersion,
    totalCases,
    passedCases,
    passRate: totalCases === 0 ? 0 : Number((passedCases / totalCases).toFixed(4)),
    avgToolF1: avg((c) => c.toolSelectionF1),
    avgArgAccuracy: avg((c) => c.argSchemaAccuracy),
    avgPolicyCompliance: avg((c) => c.policyCompliance),
    avgStepEfficiency: avg((c) => c.stepEfficiency),
    byStory,
    cases,
  };
}
