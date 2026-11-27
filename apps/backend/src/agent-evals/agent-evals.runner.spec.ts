import { describe, expect, it } from 'vitest';
import { runDeterministicAgentEvals } from './agent-evals.runner.js';
import { TRAJECTORY_GOLDEN_DATASET } from './datasets/trajectory-golden-dataset.js';
import { renderAgentEvalMarkdownReport } from './helpers/eval-markdown-report.helper.js';

describe('40-Case Trajectory Evals (KB1–KB10 & SAFETY)', () => {
  it('dataset phải chứa đúng 40 kịch bản bao phủ đủ KB1–KB10 và SAFETY', () => {
    expect(TRAJECTORY_GOLDEN_DATASET).toHaveLength(40);
    const stories = new Set(TRAJECTORY_GOLDEN_DATASET.map((c) => c.storyId));
    for (const s of [
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
    ]) {
      expect(stories.has(s as any)).toBe(true);
    }
  });

  it('runDeterministicAgentEvals đạt 40/40 passed và xuất báo cáo Markdown hợp lệ', () => {
    const report = runDeterministicAgentEvals();
    expect(report.totalCases).toBe(40);
    expect(report.passedCases).toBe(40);
    expect(report.passRate).toBe(1);
    expect(report.avgToolF1).toBe(1);
    expect(report.avgArgAccuracy).toBe(1);
    expect(report.avgPolicyCompliance).toBe(1);

    const md = renderAgentEvalMarkdownReport(report);
    expect(md).toContain('**40/40**');
    expect(md).toContain('KB10');
    expect(md).toContain('SAFETY');
  });
});
