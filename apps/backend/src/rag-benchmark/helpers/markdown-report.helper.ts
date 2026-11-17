import type {
  ModeAggregateMetrics,
  ModeComparisonDelta,
  RagBenchmarkReport,
} from '../rag-benchmark.types.js';

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatDecimal(value: number): string {
  return value.toFixed(4);
}

function formatSignedDelta(deltaPct: number): string {
  const sign = deltaPct > 0 ? '+' : '';
  return `${sign}${deltaPct.toFixed(2)} điểm %`;
}

function renderOverallRow(m: ModeAggregateMetrics): string {
  return `| **${m.modeLabel}** | ${formatPct(m.hitRateAt1)} | ${formatPct(m.hitRateAt3)} | ${formatPct(m.hitRateAt5)} | ${formatPct(m.hitRateAt8)} | ${formatDecimal(m.mrrAt5)} | ${formatPct(m.recallAt5)} | ${formatDecimal(m.ndcgAt5)} | ${formatPct(m.antiHallucinationRate)} | ${m.avgLatencyMs.toFixed(2)} ms |`;
}

function renderDeltaSection(
  title: string,
  delta: ModeComparisonDelta,
): string[] {
  return [
    `### ${title}`,
    `- **Hit Rate@1:** \`${formatSignedDelta(delta.hitRateAt1DeltaPct)}\``,
    `- **Hit Rate@5:** \`${formatSignedDelta(delta.hitRateAt5DeltaPct)}\``,
    `- **MRR@5:** \`${formatSignedDelta(delta.mrrAt5DeltaPct)}\``,
    `- **Recall@5:** \`${formatSignedDelta(delta.recallAt5DeltaPct)}\``,
    `- **NDCG@5:** \`${formatSignedDelta(delta.ndcgAt5DeltaPct)}\``,
    `- **Anti-Hallucination Rate:** \`${formatSignedDelta(delta.antiHallucinationDeltaPct)}\``,
  ];
}

export function renderRagBenchmarkMarkdown(report: RagBenchmarkReport): string {
  const lines: string[] = [
    '# BÁO CÁO THỰC NGHIỆM ĐỊNH LƯỢNG HỆ THỐNG RAG — AI-STUDYMATE',
    '',
    `> **Thời điểm chạy thực nghiệm:** \`${report.generatedAt}\``,
    `> **Phiên bản Golden Dataset:** \`${report.datasetVersion}\` | **Chế độ chạy:** \`${report.runnerType}\``,
    '',
    '---',
    '',
    '## 1. Thiết lập Thực nghiệm & Quy mô Bộ Dữ liệu Chuẩn (Golden Dataset)',
    '',
    `- **Số tài liệu giáo trình CNTT mẫu:** ${report.corpusStats.documentCount} tài liệu (Hệ điều hành, Cơ sở dữ liệu, Mạng máy tính, Kỹ thuật phần mềm, Trí tuệ nhân tạo).`,
    `- **Tổng số đoạn văn bản (Chunks đa phương thức):** ${report.corpusStats.chunkCount} chunks (bao gồm văn bản thường, bảng Markdown, công thức LaTeX, khối mã nguồn).`,
    `- **Tổng số truy vấn kiểm thử:** ${report.corpusStats.totalQueries} truy vấn (**${report.corpusStats.inScopeQueries} câu trong phạm vi** + **${report.corpusStats.outOfScopeQueries} câu bẫy ngoài phạm vi** để đo khả năng chống ảo giác).`,
    '',
    '---',
    '',
    '## 2. Bảng Đối sánh Tổng thể 4 Cấu hình Truy xuất (Ablation Study)',
    '',
    '| Cấu hình Truy xuất | Hit@1 | Hit@3 | Hit@5 | Hit@8 | MRR@5 | Recall@5 | NDCG@5 | Chống Ảo giác | Latency TB |',
    '| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |',
    ...report.modeMetrics.map(renderOverallRow),
    '',
    '---',
    '',
    '## 3. Phân tích Mức Độ Cải thiện của Hệ thống Đề xuất (Full 5-Step Pipeline)',
    '',
    ...renderDeltaSection(
      'So với Baseline 1 (Vector-Only pgvector)',
      report.deltasVsVectorOnly,
    ),
    '',
    ...renderDeltaSection(
      'So với Baseline 3 (Single-Query Hybrid RRF k=60)',
      report.deltasVsHybridRrf,
    ),
    '',
    '---',
    '',
    '## 4. Kết quả Phân rã theo 5 Nhóm Độ khó Câu hỏi (Cut-off K = 5)',
    '',
    '| Nhóm câu hỏi | Số câu | Vector-Only (Recall@5 / MRR@5) | Keyword-Only (Recall@5 / MRR@5) | Hybrid RRF (Recall@5 / MRR@5) | Full 5-Step Pipeline (Recall@5 / MRR@5) |',
    '| :--- | :---: | :---: | :---: | :---: | :---: |',
  ];

  for (const cat of report.categoryBreakdown) {
    const isTrap = cat.category === 'out_of_scope_trap';
    const formatCell = (modeKey: keyof typeof cat.byMode) => {
      const m = cat.byMode[modeKey];
      if (isTrap) {
        return `Từ chối: ${formatPct(m.antiHallucinationRate ?? 0)}`;
      }
      return `${formatPct(m.recallAt5)} / ${formatDecimal(m.mrrAt5)}`;
    };

    lines.push(
      `| **${cat.categoryLabel}** | ${cat.queryCount} | ${formatCell('vector_only')} | ${formatCell('keyword_only')} | ${formatCell('hybrid_rrf')} | **${formatCell('hybrid_rrf_rerank')}** |`,
    );
  }

  lines.push(
    '',
    '---',
    '',
    '## 5. Bảng Truy vết Chi tiết Từng Truy vấn (Traceability Log)',
    '',
    '| Mã | Nhóm | Câu hỏi | Vector Rank | Keyword Rank | Hybrid RRF Rank | Full 5-Step Rank | Recall@5 (Proposed) | Sub-Queries |',
    '| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |',
  );

  const vecList = report.queryResultsByMode.vector_only;
  const kwList = report.queryResultsByMode.keyword_only;
  const rrfList = report.queryResultsByMode.hybrid_rrf;
  const fullList = report.queryResultsByMode.hybrid_rrf_rerank;

  for (let i = 0; i < fullList.length; i++) {
    const full = fullList[i];
    const vec = vecList[i];
    const kw = kwList[i];
    const rrf = rrfList[i];

    const fmtRank = (
      item: (typeof fullList)[number] | undefined,
    ): string => {
      if (!item) return '—';
      if (item.isOutOfScope) {
        return item.rejectedOutOfScope ? 'Từ chối đúng' : 'Bẫy (Nhận sai)';
      }
      return item.firstRelevantRank !== null ? `#${item.firstRelevantRank}` : 'Miss';
    };

    const recallText = full.isOutOfScope
      ? full.rejectedOutOfScope
        ? '100% (Reject)'
        : '0% (Leak)'
      : formatPct(full.recallAt5);

    const escapedQuestion = full.question.replace(/\|/g, '\\|');
    const subQueryCount = `${full.subQueriesUsed.length} truy vấn`;

    lines.push(
      `| \`${full.queryId}\` | \`${full.category}\` | ${escapedQuestion} | ${fmtRank(vec)} | ${fmtRank(kw)} | ${fmtRank(rrf)} | **${fmtRank(full)}** | ${recallText} | ${subQueryCount} |`,
    );
  }

  lines.push('');
  return lines.join('\n');
}
