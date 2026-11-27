import type { AgentEvalReport } from '../agent-evals.types.js';

export function renderAgentEvalMarkdownReport(report: AgentEvalReport): string {
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  const lines: string[] = [
    '# Báo Cáo Đánh Giá Quỹ Đạo AI Agent (Trajectory Evals)',
    '',
    `- **Chế độ chạy:** \`${report.mode}\``,
    `- **Prompt Version:** \`${report.promptVersion}\``,
    `- **Thời gian:** ${report.generatedAt}`,
    `- **Tổng số kịch bản:** **${report.passedCases}/${report.totalCases}** (${pct(report.passRate)})`,
    `- **Tool Selection F1:** ${pct(report.avgToolF1)} | **Arg Schema Accuracy:** ${pct(report.avgArgAccuracy)} | **Policy Compliance:** ${pct(report.avgPolicyCompliance)} | **Step Efficiency:** ${pct(report.avgStepEfficiency)}`,
    '',
    '## Tổng Hợp Theo User Story (`KB1–KB10` & `SAFETY`)',
    '',
    '| Nhóm | Passed | Tỉ lệ đạt | Tool F1 | Arg Schema | Policy Compliance |',
    '| :--- | :---: | :---: | :---: | :---: | :---: |',
    ...report.byStory.map(
      (s) =>
        `| **${s.storyId}** | ${s.passedCases}/${s.totalCases} | ${pct(s.passRate)} | ${pct(s.avgToolF1)} | ${pct(s.avgArgAccuracy)} | ${pct(s.avgPolicyCompliance)} |`,
    ),
    '',
    '## Chi Tiết Từng Kịch Bản',
    '',
    '| ID | Nhóm | Kết quả | Tiêu đề | Ghi chú |',
    '| :--- | :---: | :---: | :--- | :--- |',
    ...report.cases.map(
      (c) =>
        `| \`${c.id}\` | ${c.storyId} | ${c.passed ? 'PASS' : 'FAIL'} | ${c.title} | ${c.failureReasons.join('; ') || 'OK'} |`,
    ),
    '',
  ];

  return lines.join('\n');
}
