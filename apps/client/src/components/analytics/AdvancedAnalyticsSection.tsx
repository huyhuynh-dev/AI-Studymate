"use client";

import React from 'react';
import { ArrowUpRight, HelpCircle, Layers } from 'lucide-react';
import type {
  AdvancedAnalyticsBreakdown,
  BloomMasterySummary,
  LeechCardItem,
  MissingPointCluster,
  SourceReference,
  WorkloadForecastDay,
} from '@/types';
import { BentoCard } from '@/components/analytics/AnalyticsPrimitives';
import WorkloadForecastChart from '@/components/analytics/WorkloadForecastChart';
import {
  BLOOM_META_LABELS,
  MIN_BLOOM_SAMPLE,
  MIN_RATING_DIST_SAMPLE,
  buildPlainBloomSentence,
  formatPercent,
} from '@/components/analytics/analytics-helpers';

export interface AdvancedAnalyticsSectionProps {
  advanced: AdvancedAnalyticsBreakdown;
  bloomMastery: BloomMasterySummary;
  forecast7d: WorkloadForecastDay[];
  leechCards: LeechCardItem[];
  missingPointsClusters: MissingPointCluster[];
  onJumpToSource?: (ref: SourceReference, conversationId?: string) => void;
  onOpenDeck?: (deckId: string, conversationId: string) => void;
}

export default function AdvancedAnalyticsSection({
  advanced,
  bloomMastery,
  forecast7d,
  leechCards,
  missingPointsClusters,
  onJumpToSource,
  onOpenDeck,
}: AdvancedAnalyticsSectionProps) {
  const { deckComposition, ratingDistribution } = advanced;
  const totalCards =
    deckComposition.newCount +
    deckComposition.learningCount +
    deckComposition.youngCount +
    deckComposition.matureCount;

  const hasBloomData = bloomMastery.levels.some((l) => l.totalAnswered > 0);
  const bloomSentence = buildPlainBloomSentence(bloomMastery.levels);

  const deckSegments = [
    {
      key: 'mature',
      label: 'Đã thuộc (≥ 3 tuần)',
      count: deckComposition.matureCount,
      barClass: 'bg-emerald-500 dark:bg-emerald-400',
      dotClass: 'bg-emerald-500 dark:bg-emerald-400',
    },
    {
      key: 'young',
      label: 'Còn non (< 3 tuần)',
      count: deckComposition.youngCount,
      barClass: 'bg-[#4F46E5] dark:bg-[#6366F1]',
      dotClass: 'bg-[#4F46E5] dark:bg-[#6366F1]',
    },
    {
      key: 'learning',
      label: 'Đang học',
      count: deckComposition.learningCount,
      barClass: 'bg-amber-500 dark:bg-amber-400',
      dotClass: 'bg-amber-500 dark:bg-amber-400',
    },
    {
      key: 'new',
      label: 'Thẻ mới',
      count: deckComposition.newCount,
      barClass: 'bg-neutral-300 dark:bg-white/[0.18]',
      dotClass: 'bg-neutral-300 dark:bg-white/[0.18]',
    },
  ];

  const ratingRows = [
    { key: 'again', label: 'Quên', count: ratingDistribution.again, barClass: 'bg-rose-400 dark:bg-rose-400' },
    { key: 'hard', label: 'Khó', count: ratingDistribution.hard, barClass: 'bg-amber-400 dark:bg-amber-400' },
    { key: 'good', label: 'Tốt', count: ratingDistribution.good, barClass: 'bg-[#4F46E5] dark:bg-[#6366F1]' },
    { key: 'easy', label: 'Dễ', count: ratingDistribution.easy, barClass: 'bg-emerald-500 dark:bg-emerald-400' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Kho thẻ 4 nhóm */}
        <BentoCard className="p-5 sm:p-6 lg:col-span-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base sm:text-lg font-bold font-heading tracking-tight text-neutral-900 dark:text-[#EFF0F6] leading-[1.2]">
                Phân bố kho thẻ ({totalCards} thẻ)
              </h3>
              <p className="mt-1 text-xs text-neutral-500 dark:text-[#9DA3AF]">
                Bức tranh tổng thể lượng kiến thức đã thuộc vững so với thẻ mới.
              </p>
            </div>
          </div>

          {totalCards === 0 ? (
            <p className="text-xs text-neutral-500 dark:text-[#9DA3AF] py-4">
              Chưa có thẻ ghi nhớ nào trong phạm vi này.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/[0.06]">
                {deckSegments.map((seg) => {
                  const pct = (seg.count / totalCards) * 100;
                  if (seg.count === 0) return null;
                  return (
                    <div
                      key={seg.key}
                      title={`${seg.label}: ${seg.count} thẻ`}
                      className={`h-full transition-all duration-300 motion-reduce:transition-none ${seg.barClass}`}
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
                {deckSegments.map((seg) => (
                  <div
                    key={seg.key}
                    className="flex items-center justify-between rounded-xl border border-black/[0.04] dark:border-white/[0.06] bg-neutral-50/80 dark:bg-white/[0.035] px-3 py-2"
                  >
                    <span className="inline-flex items-center gap-2 text-neutral-600 dark:text-[#9DA3AF]">
                      <span className={`h-2.5 w-2.5 rounded-full ${seg.dotClass}`} />
                      <span>{seg.label}</span>
                    </span>
                    <span className="font-bold text-neutral-900 dark:text-[#EFF0F6]">
                      {seg.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </BentoCard>

        {/* Phân bố đánh giá khi ôn thẻ */}
        <BentoCard className="p-5 sm:p-6 lg:col-span-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base sm:text-lg font-bold font-heading tracking-tight text-neutral-900 dark:text-[#EFF0F6] leading-[1.2]">
                Phân bố đánh giá khi ôn thẻ
              </h3>
              <p className="mt-1 text-xs text-neutral-500 dark:text-[#9DA3AF]">
                {ratingDistribution.total < MIN_RATING_DIST_SAMPLE
                  ? `Cần ≥ ${MIN_RATING_DIST_SAMPLE} lượt ôn để ổn định (hiện có ${ratingDistribution.total} lượt).`
                  : `Tổng cộng ${ratingDistribution.total} lượt ôn trong kỳ đã chọn.`}
              </p>
            </div>
          </div>

          {ratingDistribution.total === 0 ? (
            <p className="text-xs text-neutral-500 dark:text-[#9DA3AF] py-4">
              Chưa có lượt ôn thẻ nào trong khoảng thời gian này.
            </p>
          ) : (
            <div
              className={`space-y-2.5 ${
                ratingDistribution.total < MIN_RATING_DIST_SAMPLE ? 'opacity-75' : ''
              }`}
            >
              {ratingRows.map((row) => {
                const pct =
                  ratingDistribution.total > 0
                    ? Math.round((row.count / ratingDistribution.total) * 100)
                    : 0;
                return (
                  <div key={row.key} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between tabular-nums">
                      <span className="font-medium text-neutral-700 dark:text-[#9DA3AF]">
                        {row.label}
                      </span>
                      <span className="font-semibold text-neutral-900 dark:text-[#EFF0F6]">
                        {row.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full ${row.barClass}`}
                        style={{ width: pct === 0 ? '0%' : `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {advanced.flaggedCorrectCount >= 5 && (
            <div className="flex items-center gap-2 rounded-xl border border-black/[0.05] dark:border-white/[0.08] bg-neutral-50/80 dark:bg-white/[0.035] px-3 py-2 text-xs text-neutral-600 dark:text-[#9DA3AF]">
              <HelpCircle className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
              <span>
                Có <strong className="text-neutral-900 dark:text-[#EFF0F6]">{advanced.flaggedCorrectCount} câu</strong> bạn đánh dấu &ldquo;chưa chắc&rdquo; nhưng trả lời đúng — hãy ôn lại thêm 1 lần cho thật vững.
              </span>
            </div>
          )}
        </BentoCard>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Kiểu câu hỏi bạn làm tốt / chưa tốt (Bloom đã Việt hóa) */}
        <BentoCard className="p-5 sm:p-6 lg:col-span-7 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold font-heading tracking-tight text-neutral-900 dark:text-[#EFF0F6] leading-[1.2]">
                Kiểu câu hỏi bạn làm tốt / chưa tốt
              </h3>
              <p className="mt-1 text-xs text-neutral-600 dark:text-[#9DA3AF] leading-relaxed">
                {bloomSentence}
              </p>
            </div>
            {bloomMastery.untaggedCount > 0 && (
              <span className="shrink-0 rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/80 dark:bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium tabular-nums text-neutral-500 dark:text-[#9DA3AF]">
                {bloomMastery.untaggedCount} câu cũ chưa phân loại
              </span>
            )}
          </div>

          {!hasBloomData ? (
            <div className="rounded-2xl border border-dashed border-black/[0.08] dark:border-white/[0.1] bg-neutral-50/70 dark:bg-white/[0.03] px-5 py-8 text-center text-xs text-neutral-500 dark:text-[#9DA3AF]">
              Hoàn thành bài kiểm tra có phân loại mức tư duy để xem chi tiết tại đây.
            </div>
          ) : (
            <div className="space-y-3">
              {bloomMastery.levels.map((item) => {
                const meta = BLOOM_META_LABELS[item.level];
                const pct = item.accuracyRate ?? 0;
                const isLowSample = item.totalAnswered < MIN_BLOOM_SAMPLE;

                return (
                  <div
                    key={item.level}
                    className={`space-y-1.5 ${isLowSample ? 'opacity-65' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-neutral-800 dark:text-[#EFF0F6]">
                        {meta.label}
                      </span>
                      <div className="flex items-center gap-2 tabular-nums">
                        <span className="text-neutral-500 dark:text-[#9DA3AF]">
                          {item.totalAnswered > 0
                            ? isLowSample
                              ? `Ít dữ liệu (${item.totalAnswered}/${MIN_BLOOM_SAMPLE} câu)`
                              : `${item.correctCount} đúng / ${item.totalAnswered} câu`
                            : 'Chưa có câu hỏi'}
                        </span>
                        <span className="min-w-[40px] text-right font-bold text-neutral-900 dark:text-[#EFF0F6]">
                          {formatPercent(item.accuracyRate)}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${meta.barClass}`}
                        style={{
                          width:
                            item.totalAnswered === 0 || pct === 0
                              ? '0%'
                              : `${Math.max(4, pct)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </BentoCard>

        {/* Lịch ôn tuần tới */}
        <div className="lg:col-span-5">
          <WorkloadForecastChart forecast={forecast7d} />
        </div>
      </div>

      {/* Thẻ hay quên & Ý hay bỏ sót khi viết */}
      {(leechCards.length > 0 || missingPointsClusters.length > 0) && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <BentoCard className="p-5 sm:p-6 space-y-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold font-heading tracking-tight text-neutral-900 dark:text-[#EFF0F6] leading-[1.2]">
                Thẻ hay quên ({leechCards.length})
              </h3>
              <p className="mt-1 text-xs text-neutral-500 dark:text-[#9DA3AF]">
                Gợi ý: đọc lại đoạn gốc trong tài liệu hoặc tách thẻ thành ý ngắn hơn để dễ nhớ.
              </p>
            </div>

            {leechCards.length === 0 ? (
              <p className="text-xs text-neutral-500 dark:text-[#9DA3AF] py-3">
                Chưa ghi nhận thẻ nào bị quên nhiều lần.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {leechCards.map((card) => {
                  const firstRef = card.sourceRefs[0];
                  return (
                    <div
                      key={card.id}
                      className="flex flex-col gap-2.5 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-neutral-50/80 dark:bg-white/[0.035] p-3.5"
                    >
                      <p className="text-xs sm:text-[13px] font-semibold text-neutral-900 dark:text-[#EFF0F6] leading-snug line-clamp-2">
                        {card.frontText}
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs tabular-nums text-neutral-500 dark:text-[#9DA3AF]">
                          {card.deckName} ·{' '}
                          <strong className="text-amber-700 dark:text-amber-400">
                            Quên {card.againCount} lần
                          </strong>
                        </span>
                        <div className="flex items-center gap-1.5">
                          {firstRef && onJumpToSource && (
                            <button
                              type="button"
                              onClick={() => onJumpToSource(firstRef, card.conversationId)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] px-2.5 text-[11px] font-semibold text-neutral-700 dark:text-[#EFF0F6] hover:bg-neutral-100 dark:hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                            >
                              <span>Xem nguồn</span>
                              <ArrowUpRight className="h-3 w-3" />
                            </button>
                          )}
                          {onOpenDeck && (
                            <button
                              type="button"
                              onClick={() => onOpenDeck(card.deckId, card.conversationId)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/[0.14] border border-transparent dark:border-indigo-400/20 px-2.5 text-[11px] font-semibold text-[#4F46E5] dark:text-[#818CF8] hover:bg-indigo-500/20 dark:hover:bg-indigo-500/[0.22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                            >
                              <Layers className="h-3 w-3" />
                              <span>Mở bộ thẻ</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </BentoCard>

          <BentoCard className="p-5 sm:p-6 space-y-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold font-heading tracking-tight text-neutral-900 dark:text-[#EFF0F6] leading-[1.2]">
                Ý quan trọng hay bỏ sót khi viết ({missingPointsClusters.length})
              </h3>
              <p className="mt-1 text-xs text-neutral-500 dark:text-[#9DA3AF]">
                Tổng hợp từ phần chấm bài tự luận để bạn chú ý diễn đạt đủ ý hơn.
              </p>
            </div>

            {missingPointsClusters.length === 0 ? (
              <p className="text-xs text-neutral-500 dark:text-[#9DA3AF] py-3">
                Chưa ghi nhận ý tự luận nào bị bỏ sót.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {missingPointsClusters.map((cluster, idx) => {
                  const firstRef = cluster.sourceRefs[0];
                  return (
                    <div
                      key={`${cluster.point}-${idx}`}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-neutral-50/80 dark:bg-white/[0.035] p-3.5"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="rounded-full bg-amber-500/12 dark:bg-amber-500/[0.14] px-2 py-0.5 font-semibold tabular-nums text-amber-800 dark:text-amber-300">
                            Thiếu {cluster.frequency} lần
                          </span>
                          {cluster.bloomLevels.map((lvl) => (
                            <span
                              key={lvl}
                              className="rounded-full bg-neutral-200/70 dark:bg-white/[0.08] px-2 py-0.5 font-medium text-neutral-700 dark:text-neutral-300"
                            >
                              {BLOOM_META_LABELS[lvl].short}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs sm:text-[13px] font-semibold text-neutral-900 dark:text-[#EFF0F6] leading-snug">
                          {cluster.point}
                        </p>
                      </div>

                      {firstRef && onJumpToSource && (
                        <button
                          type="button"
                          onClick={() => onJumpToSource(firstRef)}
                          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] px-2.5 text-[11px] font-semibold text-neutral-700 dark:text-[#EFF0F6] hover:bg-neutral-100 dark:hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                        >
                          <span>Nguồn</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </BentoCard>
        </div>
      )}
    </div>
  );
}
