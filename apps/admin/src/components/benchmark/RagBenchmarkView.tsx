'use client';

import { useState } from 'react';
import { IconSearch } from '@/components/ui/AdminIcons';
import type {
  BenchmarkQueryCategory,
  RagBenchmarkMode,
  RagBenchmarkReportData,
} from '@/types/admin';

interface RagBenchmarkViewProps {
  report: RagBenchmarkReportData | null;
}

const MODE_ORDER: RagBenchmarkMode[] = [
  'vector_only',
  'keyword_only',
  'hybrid_rrf',
  'hybrid_rrf_rerank',
];

const MODE_LABELS: Record<RagBenchmarkMode, string> = {
  vector_only: 'Vector-Only (pgvector)',
  keyword_only: 'Keyword-Only (PGroonga)',
  hybrid_rrf: 'Single-Query Hybrid RRF',
  hybrid_rrf_rerank: 'Full 5-Step Hybrid + Rerank',
};

const CATEGORY_OPTIONS: Array<{ key: 'all' | BenchmarkQueryCategory; label: string }> = [
  { key: 'all', label: 'Tất cả nhóm' },
  { key: 'semantic_lookup', label: 'Ngữ nghĩa (Semantic)' },
  { key: 'exact_technical', label: 'Kỹ thuật / Bảng / Công thức' },
  { key: 'bilingual_acronym', label: 'Đa ngữ & Viết tắt' },
  { key: 'multi_hop_comparison', label: 'So sánh Đa chương' },
  { key: 'out_of_scope_trap', label: 'Bẫy Ngoài phạm vi' },
];

function formatPct(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

function formatDeltaPct(delta: number): string {
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RagBenchmarkView({ report }: RagBenchmarkViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | BenchmarkQueryCategory
  >('all');
  const [querySearch, setQuerySearch] = useState('');
  const [baselineCompareMode, setBaselineCompareMode] =
    useState<RagBenchmarkMode>('vector_only');

  if (!report) {
    return (
      <div className="rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]">
        <div className="rounded-[16px] p-10 bg-[#1C1C22]/45 text-center text-[14px] text-[#A1A1AA]">
          Đang tải kết quả Thực nghiệm Định lượng RAG...
        </div>
      </div>
    );
  }

  const orderedMetrics = [...report.modeMetrics].sort(
    (a, b) => MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode),
  );

  const proposedCases = report.queryResultsByMode.hybrid_rrf_rerank ?? [];
  const baselineCaseMap = new Map(
    (report.queryResultsByMode[baselineCompareMode] ?? []).map((item) => [
      item.queryId,
      item,
    ]),
  );

  const filteredCases = proposedCases.filter((item) => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) {
      return false;
    }
    const q = querySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      item.question.toLowerCase().includes(q) ||
      item.queryId.toLowerCase().includes(q)
    );
  });

  const deltaCards = [
    {
      label: 'Cải thiện Hit Rate@1 (vs Vector-Only)',
      value: formatDeltaPct(report.deltasVsVectorOnly.hitRateAt1DeltaPct),
      sub: `Hit@5: ${formatDeltaPct(report.deltasVsVectorOnly.hitRateAt5DeltaPct)} điểm %`,
    },
    {
      label: 'Cải thiện MRR@5 (vs Vector-Only)',
      value: formatDeltaPct(report.deltasVsVectorOnly.mrrAt5DeltaPct),
      sub: `vs Hybrid RRF: ${formatDeltaPct(report.deltasVsHybridRrf.mrrAt5DeltaPct)} điểm %`,
    },
    {
      label: 'Cải thiện NDCG@5 (vs Vector-Only)',
      value: formatDeltaPct(report.deltasVsVectorOnly.ndcgAt5DeltaPct),
      sub: `Recall@5: ${formatDeltaPct(report.deltasVsVectorOnly.recallAt5DeltaPct)} điểm %`,
    },
    {
      label: 'Chống Ảo giác (Anti-Hallucination)',
      value: formatDeltaPct(
        report.deltasVsVectorOnly.antiHallucinationDeltaPct,
      ),
      sub: `vs Hybrid RRF: ${formatDeltaPct(
        report.deltasVsHybridRrf.antiHallucinationDeltaPct,
      )} điểm %`,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Corpus & Delta Overview */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-[#A1A1AA]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-[8px] bg-[#121216] border border-white/[0.08] text-[#F5F5F7] font-mono text-[12px]">
              Golden Dataset v{report.datasetVersion}
            </span>
            <span className="tabular-nums">
              {report.corpusStats.documentCount} môn học •{' '}
              {report.corpusStats.chunkCount} chunks •{' '}
              {report.corpusStats.totalQueries} truy vấn (
              {report.corpusStats.inScopeQueries} in-scope,{' '}
              {report.corpusStats.outOfScopeQueries} out-of-scope traps)
            </span>
          </div>
          <span className="tabular-nums text-[12px] text-[#71717A]">
            Lần chạy cuối: {formatDateTime(report.generatedAt)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {deltaCards.map((card) => (
            <div
              key={card.label}
              className="rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]"
            >
              <div className="rounded-[16px] p-5 bg-[#1C1C22]/55 border border-white/[0.05]">
                <p className="text-[12px] text-[#A1A1AA]">{card.label}</p>
                <p className="mt-2 tabular-nums text-[28px] font-semibold tracking-[-0.025em] text-[#30D158]">
                  {card.value}
                </p>
                <p className="mt-1 tabular-nums text-[12px] text-[#A1A1AA]">
                  {card.sub}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4-Mode Ablation Study Matrix */}
      <section className="rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]">
        <div className="rounded-[16px] p-6 bg-[#1C1C22]/45 border border-white/[0.05] space-y-4">
          <div>
            <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-[#F5F5F7]">
              Bảng Đối sánh Định lượng 4 Chế độ Truy xuất (Ablation Study)
            </h2>
            <p className="mt-0.5 text-[13px] text-[#A1A1AA]">
              Đánh giá chuẩn Truy xuất Thông tin (IR) trên cùng tập dữ liệu kiểm thử học thuật.
            </p>
          </div>

          <div className="overflow-x-auto rounded-[12px] border border-white/[0.06]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#121216] text-[11.5px] font-medium uppercase tracking-wider text-[#71717A] border-b border-white/[0.08]">
                  <th className="py-3 px-4">Chế độ Truy xuất</th>
                  <th className="py-3 px-3 text-right">Hit@1</th>
                  <th className="py-3 px-3 text-right">Hit@3</th>
                  <th className="py-3 px-3 text-right">Hit@5</th>
                  <th className="py-3 px-3 text-right">MRR@5</th>
                  <th className="py-3 px-3 text-right">Recall@5</th>
                  <th className="py-3 px-3 text-right">NDCG@5</th>
                  <th className="py-3 px-3 text-right">Anti-Halluc.</th>
                  <th className="py-3 px-4 text-right">Avg / P95 Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-[13px]">
                {orderedMetrics.map((m) => {
                  const isProposed = m.mode === 'hybrid_rrf_rerank';
                  return (
                    <tr
                      key={m.mode}
                      className={
                        isProposed
                          ? 'bg-[#0A84FF]/[0.08] hover:bg-[#0A84FF]/[0.12]'
                          : 'hover:bg-white/[0.025]'
                      }
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-medium ${
                              isProposed ? 'text-white' : 'text-[#F5F5F7]'
                            }`}
                          >
                            {m.modeLabel || MODE_LABELS[m.mode]}
                          </span>
                          {isProposed && (
                            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#0A84FF] text-white">
                              Đề xuất
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums font-medium text-[#F5F5F7]">
                        {formatPct(m.hitRateAt1)}
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums text-[#D4D4D8]">
                        {formatPct(m.hitRateAt3)}
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums font-medium text-[#F5F5F7]">
                        {formatPct(m.hitRateAt5)}
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums font-medium text-[#0A84FF]">
                        {m.mrrAt5.toFixed(3)}
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums text-[#D4D4D8]">
                        {formatPct(m.recallAt5)}
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums font-medium text-[#30D158]">
                        {m.ndcgAt5.toFixed(3)}
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums text-[#D4D4D8]">
                        {formatPct(m.antiHallucinationRate)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-[#A1A1AA]">
                        {m.avgLatencyMs.toFixed(2)} / {m.p95LatencyMs.toFixed(2)} ms
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Category Breakdown */}
      <section className="rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]">
        <div className="rounded-[16px] p-6 bg-[#1C1C22]/45 border border-white/[0.05] space-y-4">
          <div>
            <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-[#F5F5F7]">
              Phân tích Chuyên sâu Theo 5 Nhóm Câu hỏi Học thuật
            </h2>
            <p className="mt-0.5 text-[13px] text-[#A1A1AA]">
              Đối sánh hiệu năng giữa Baseline Vector-Only và Pipeline 5 bước trên từng loại câu hỏi.
            </p>
          </div>

          <div className="overflow-x-auto rounded-[12px] border border-white/[0.06]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#121216] text-[11.5px] font-medium uppercase tracking-wider text-[#71717A] border-b border-white/[0.08]">
                  <th className="py-3 px-4">Nhóm Câu hỏi</th>
                  <th className="py-3 px-3 text-right">Số câu</th>
                  <th className="py-3 px-3 text-right">Vector Hit@5 / Anti-H</th>
                  <th className="py-3 px-3 text-right">Keyword Hit@5</th>
                  <th className="py-3 px-3 text-right">Hybrid RRF NDCG@5</th>
                  <th className="py-3 px-4 text-right">Full 5-Step NDCG@5 / Anti-H</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-[13px]">
                {report.categoryBreakdown.map((cat) => {
                  const vec = cat.byMode.vector_only;
                  const kw = cat.byMode.keyword_only;
                  const rrf = cat.byMode.hybrid_rrf;
                  const prop = cat.byMode.hybrid_rrf_rerank;
                  const isTrap = cat.category === 'out_of_scope_trap';

                  return (
                    <tr key={cat.category} className="hover:bg-white/[0.025]">
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#F5F5F7]">
                          {cat.categoryLabel}
                        </div>
                        <div className="text-[11.5px] font-mono text-[#71717A]">
                          {cat.category}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums text-[#D4D4D8]">
                        {cat.queryCount}
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums text-[#A1A1AA]">
                        {isTrap
                          ? formatPct(vec.antiHallucinationRate ?? 0)
                          : formatPct(vec.hitRateAt5)}
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums text-[#A1A1AA]">
                        {isTrap
                          ? formatPct(kw.antiHallucinationRate ?? 0)
                          : formatPct(kw.hitRateAt5)}
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums text-[#D4D4D8]">
                        {isTrap
                          ? formatPct(rrf.antiHallucinationRate ?? 0)
                          : `${rrf.ndcgAt5.toFixed(3)} (${formatPct(rrf.hitRateAt5)})`}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-medium text-[#30D158]">
                        {isTrap
                          ? formatPct(prop.antiHallucinationRate ?? 0)
                          : `${prop.ndcgAt5.toFixed(3)} (${formatPct(prop.hitRateAt5)})`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Per-Query Case Inspector */}
      <section className="rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]">
        <div className="rounded-[16px] p-6 bg-[#1C1C22]/45 border border-white/[0.05] space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-[#F5F5F7]">
                Trình Tra cứu Từng Kịch bản Câu hỏi (Case Inspector)
              </h2>
              <p className="mt-0.5 tabular-nums text-[13px] text-[#A1A1AA]">
                Đang hiển thị {filteredCases.length} / {proposedCases.length} câu hỏi
                trong bộ Golden Dataset
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label="Lọc theo nhóm câu hỏi"
                value={selectedCategory}
                onChange={(e) =>
                  setSelectedCategory(
                    e.target.value as 'all' | BenchmarkQueryCategory,
                  )
                }
                className="h-9 px-3 rounded-[10px] bg-[#121216] border border-white/[0.1] text-[12.5px] text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                aria-label="Chọn chế độ đối chiếu"
                value={baselineCompareMode}
                onChange={(e) =>
                  setBaselineCompareMode(e.target.value as RagBenchmarkMode)
                }
                className="h-9 px-3 rounded-[10px] bg-[#121216] border border-white/[0.1] text-[12.5px] text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
              >
                <option value="vector_only">Đối chiếu: Vector-Only</option>
                <option value="keyword_only">Đối chiếu: Keyword-Only</option>
                <option value="hybrid_rrf">Đối chiếu: Hybrid RRF</option>
              </select>

              <div className="relative">
                <IconSearch className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={querySearch}
                  onChange={(e) => setQuerySearch(e.target.value)}
                  placeholder="Tìm mã Q hoặc nội dung..."
                  aria-label="Tìm câu hỏi benchmark"
                  className="h-9 w-56 pl-9 pr-3 rounded-[10px] bg-[#121216] border border-white/[0.1] text-[13px] text-[#F5F5F7] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
            {filteredCases.map((item) => {
              const baseItem = baselineCaseMap.get(item.queryId);
              return (
                <div
                  key={item.queryId}
                  className="rounded-[12px] p-4 bg-[#121216] border border-white/[0.07] space-y-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11.5px] font-semibold px-2 py-0.5 rounded bg-white/[0.06] text-[#F5F5F7]">
                          {item.queryId}
                        </span>
                        <span className="text-[11.5px] font-mono text-[#A1A1AA]">
                          {item.category}
                        </span>
                        {item.isOutOfScope && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FFD60A]/15 text-[#FFD60A] border border-[#FFD60A]/30">
                            Out-of-Scope Trap
                          </span>
                        )}
                      </div>
                      <p className="text-[13.5px] font-medium text-[#F5F5F7]">
                        {item.question}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-[12px] tabular-nums shrink-0">
                      <div className="text-right">
                        <span className="block text-[11px] text-[#71717A]">
                          {MODE_LABELS[baselineCompareMode].split(' ')[0]}
                        </span>
                        <span className="text-[#A1A1AA]">
                          {item.isOutOfScope
                            ? baseItem?.rejectedOutOfScope
                              ? 'Từ chối đúng'
                              : 'Ảo giác'
                            : `Rank ${baseItem?.firstRelevantRank ?? '—'} • NDCG ${(
                                baseItem?.ndcgAt5 ?? 0
                              ).toFixed(2)}`}
                        </span>
                      </div>

                      <span className="text-white/20">→</span>

                      <div className="text-right">
                        <span className="block text-[11px] text-[#0A84FF]">
                          5-Step Proposed
                        </span>
                        <span className="font-semibold text-[#30D158]">
                          {item.isOutOfScope
                            ? item.rejectedOutOfScope
                              ? 'Từ chối đúng'
                              : 'Ảo giác'
                            : `Rank ${item.firstRelevantRank ?? '—'} • NDCG ${item.ndcgAt5.toFixed(
                                2,
                              )}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {item.subQueriesUsed.length > 1 && (
                    <div className="pt-2 border-t border-white/[0.06] text-[12px] text-[#A1A1AA]">
                      <span className="text-[#71717A]">Sub-queries phân rã: </span>
                      <span className="font-mono text-[#D4D4D8]">
                        {item.subQueriesUsed.join('  |  ')}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
