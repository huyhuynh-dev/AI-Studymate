import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  runDeterministicAgentEvals,
  runLiveAgentEvals,
} from '../agent-evals.runner.js';
import { renderAgentEvalMarkdownReport } from '../helpers/eval-markdown-report.helper.js';

async function main() {
  const args = process.argv.slice(2);
  const modeArg = args.find((a) => a.startsWith('--mode='))?.split('=')[1];
  const mode = modeArg === 'live' ? 'live' : 'deterministic';

  const outArg = args.find((a) => a.startsWith('--out='))?.split('=')[1];
  const outPath =
    outArg ||
    path.resolve(process.cwd(), 'reports', 'agent-evals-latest.md');

  const report =
    mode === 'live'
      ? await runLiveAgentEvals()
      : runDeterministicAgentEvals();

  const markdown = renderAgentEvalMarkdownReport(report);
  const dir = path.dirname(outPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(outPath, markdown, 'utf-8');

  console.log(
    `[AgentEvals] mode=${report.mode} | passed=${report.passedCases}/${report.totalCases} (${(report.passRate * 100).toFixed(1)}%) | ToolF1=${(report.avgToolF1 * 100).toFixed(1)}% | ArgAcc=${(report.avgArgAccuracy * 100).toFixed(1)}% | Policy=${(report.avgPolicyCompliance * 100).toFixed(1)}%`,
  );
  console.log(`[AgentEvals] Report saved to ${outPath}`);

  if (report.passedCases < report.totalCases) {
    process.exitCode = 1;
  }
}

void main();
