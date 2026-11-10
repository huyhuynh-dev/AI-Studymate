import type { QuizAttempt } from "../types";
import { toPct } from "../utils";

/** Biểu đồ đường điểm số qua các lần làm (SVG thuần, theo màu ngữ nghĩa) */
export function ProgressChart({ attempts }: { attempts: QuizAttempt[] }) {
  const data = [...attempts].filter((a) => a.status === "submitted").reverse().map((a, i) => ({ n: i + 1, pct: toPct(a.score, a.maxScore) }));
  if (data.length === 0) return null;
  const W = 520, H = 180, L = 36, R = 16, T = 16, B = 28;
  const x = (i: number) => (data.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (data.length - 1));
  const y = (p: number) => T + ((100 - p) * (H - T - B)) / 100;
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.pct)}`).join(" ");
  const summary = data.map((d) => `Lần ${d.n}: ${d.pct}%`).join(", ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Điểm số theo các lần làm. ${summary}`}>
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="var(--border-subtle)" strokeDasharray={g === 50 ? "4 4" : undefined} />
          <text x={L - 8} y={y(g) + 4} textAnchor="end" fontSize="11" fill="var(--on-surface-variant)" className="tabular-nums">{g}%</text>
        </g>
      ))}
      {data.length > 1 && <path d={path} fill="none" stroke="var(--brand-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {data.map((d, i) => (
        <g key={d.n}>
          <circle cx={x(i)} cy={y(d.pct)} r="6" fill="var(--surface-card)" stroke="var(--brand-primary)" strokeWidth="2.5" />
          <text x={x(i)} y={y(d.pct) - 12} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--foreground)" className="tabular-nums">{d.pct}%</text>
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--on-surface-variant)">Lần {d.n}</text>
        </g>
      ))}
    </svg>
  );
}
