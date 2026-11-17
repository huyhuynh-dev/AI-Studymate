import { RagBenchmarkService } from '../rag-benchmark.service.js';

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function fmtDelta(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)} điểm %`;
}

function main(): void {
  const service = new RagBenchmarkService();
  const dataset = service.getDatasetSummary();

  console.log('\n================================================================');
  console.log('  AI-STUDYMATE — THỰC NGHIỆM ĐỊNH LƯỢNG HỆ THỐNG RAG (PHASE 1)');
  console.log('================================================================');
  console.log(`Dataset Version : ${dataset.version}`);
  console.log(`Corpus          : ${dataset.corpusDocumentCount} tài liệu | ${dataset.corpusChunkCount} chunks`);
  console.log(`Tổng câu hỏi    : ${dataset.totalQueries} câu (5 nhóm độ khó)`);
  console.log('Phân bổ nhóm    :', dataset.categoryCounts);

  const report = service.runGoldenAblationBenchmark({ persistToDisk: false });
  const { markdownPath, jsonPath } = service.persistReportArtifacts(report);

  console.log('\n--- BẢNG ĐỐI SÁNH TỔNG THỂ 4 CẤU HÌNH TRUY XUẤT (ABLATION STUDY) ---');
  console.table(
    report.modeMetrics.map((m) => ({
      'Cấu hình': m.modeLabel,
      'Hit@1': pct(m.hitRateAt1),
      'Hit@3': pct(m.hitRateAt3),
      'Hit@5': pct(m.hitRateAt5),
      'Hit@8': pct(m.hitRateAt8),
      'MRR@5': m.mrrAt5.toFixed(4),
      'Recall@5': pct(m.recallAt5),
      'NDCG@5': m.ndcgAt5.toFixed(4),
      'Chống ảo giác': pct(m.antiHallucinationRate),
      'Latency TB': `${m.avgLatencyMs.toFixed(2)} ms`,
    })),
  );

  console.log('--- MỨC CẢI THIỆN (FULL 5-STEP PIPELINE vs VECTOR-ONLY BASELINE) ---');
  console.table([
    {
      'Hit@1 Delta': fmtDelta(report.deltasVsVectorOnly.hitRateAt1DeltaPct),
      'Hit@5 Delta': fmtDelta(report.deltasVsVectorOnly.hitRateAt5DeltaPct),
      'MRR@5 Delta': fmtDelta(report.deltasVsVectorOnly.mrrAt5DeltaPct),
      'Recall@5 Delta': fmtDelta(report.deltasVsVectorOnly.recallAt5DeltaPct),
      'NDCG@5 Delta': fmtDelta(report.deltasVsVectorOnly.ndcgAt5DeltaPct),
      'Anti-Hallucination Delta': fmtDelta(
        report.deltasVsVectorOnly.antiHallucinationDeltaPct,
      ),
    },
  ]);

  console.log('--- PHÂN RÃ THEO 5 NHÓM ĐỘ KHÓ (RECALL@5 / CHỐNG ẢO GIÁC) ---');
  console.table(
    report.categoryBreakdown.map((cat) => {
      const isTrap = cat.category === 'out_of_scope_trap';
      const fmt = (mode: keyof typeof cat.byMode) =>
        isTrap
          ? pct(cat.byMode[mode].antiHallucinationRate ?? 0)
          : pct(cat.byMode[mode].recallAt5);
      return {
        'Nhóm câu hỏi': cat.categoryLabel,
        'Số câu': cat.queryCount,
        'Vector-Only': fmt('vector_only'),
        'Keyword-Only': fmt('keyword_only'),
        'Hybrid RRF': fmt('hybrid_rrf'),
        'Full 5-Step': fmt('hybrid_rrf_rerank'),
      };
    }),
  );

  console.log('\nĐã xuất 2 tệp báo cáo vật lý:');
  console.log(`  1. Markdown Report : ${markdownPath}`);
  console.log(`  2. JSON Raw Data   : ${jsonPath}\n`);
}

main();
