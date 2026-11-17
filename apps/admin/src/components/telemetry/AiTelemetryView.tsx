'use client';

import type { AdminAiUsageData } from '@/types/admin';

interface AiTelemetryViewProps {
  aiUsage: AdminAiUsageData | null;
  windowDays: number;
  onChangeWindowDays: (days: number) => void;
}

const WINDOW_OPTIONS = [
  { days: 7, label: '7 ngày' },
  { days: 14, label: '14 ngày' },
  { days: 30, label: '30 ngày' },
  { days: 90, label: '90 ngày' },
];

function formatNumber(val: number): string {
  return new Intl.NumberFormat('vi-VN').format(val);
}

function formatUsd(val: number): string {
  return `$${val.toFixed(6)}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getProfileBadgeStyle(profile: string): string {
  switch (profile.toUpperCase()) {
    case 'REASONING':
      return 'bg-[#0A84FF]/15 text-[#0A84FF] border-[#0A84FF]/30';
    case 'FAST':
      return 'bg-[#30D158]/15 text-[#30D158] border-[#30D158]/30';
    case 'VISION':
      return 'bg-[#FFD60A]/15 text-[#FFD60A] border-[#FFD60A]/30';
    default:
      return 'bg-white/[0.06] text-[#D4D4D8] border-white/[0.1]';
  }
}

export function AiTelemetryView({
  aiUsage,
  windowDays,
  onChangeWindowDays,
}: AiTelemetryViewProps) {
  const summary = aiUsage?.summary ?? {
    totalRequests: 0,
    successRequests: 0,
    errorRequests: 0,
    successRatePct: 100,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    avgLatencyMs: 0,
  };
  const byFeature = aiUsage?.byFeature ?? [];
  const byProfile = aiUsage?.byProfile ?? [];
  const dailyTrend = aiUsage?.dailyTrend ?? [];
  const recentLogs = aiUsage?.recentLogs ?? [];

  const maxFeatureTokens = Math.max(
    1,
    ...byFeature.map((item) => item.totalTokens),
  );
  const maxDailyTokens = Math.max(
    1,
    ...dailyTrend.map((point) => point.totalTokens),
  );

  return (
    <div className="space-y-8">
      {/* Window Selector + Summary Cards */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-[#A1A1AA]">
            Thống kê chi phí và lượng token tiêu thụ trong{' '}
            <strong className="tabular-nums text-[#F5F5F7]">
              {windowDays} ngày
            </strong>{' '}
            gần nhất
          </p>

          <div
            role="group"
            aria-label="Khung thời gian thống kê"
            className="inline-flex p-1 rounded-[12px] bg-[#121216] border border-white/[0.08]"
          >
            {WINDOW_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                type="button"
                onClick={() => onChangeWindowDays(opt.days)}
                className={`spring-interactive min-h-[32px] px-3 rounded-[9px] text-[12.5px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF] ${
                  windowDays === opt.days
                    ? 'bg-[#2C2C34] text-[#F5F5F7]'
                    : 'text-[#A1A1AA] hover:text-[#F5F5F7]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]">
            <div className="rounded-[16px] p-5 bg-[#1C1C22]/55 border border-white/[0.05]">
              <p className="text-[12.5px] text-[#A1A1AA]">Tổng Lượt gọi AI</p>
              <p className="mt-2 tabular-nums text-[30px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
                {formatNumber(summary.totalRequests)}
              </p>
              <p className="mt-1 tabular-nums text-[12px] text-[#30D158]">
                {summary.successRatePct}% thành công ({formatNumber(summary.errorRequests)}{' '}
                lỗi)
              </p>
            </div>
          </div>

          <div className="rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]">
            <div className="rounded-[16px] p-5 bg-[#1C1C22]/55 border border-white/[0.05]">
              <p className="text-[12.5px] text-[#A1A1AA]">Tổng Token Tiêu thụ</p>
              <p className="mt-2 tabular-nums text-[30px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
                {formatNumber(summary.totalTokens)}
              </p>
              <p className="mt-1 tabular-nums text-[12px] text-[#A1A1AA]">
                In: {formatNumber(summary.promptTokens)} • Out:{' '}
                {formatNumber(summary.completionTokens)}
              </p>
            </div>
          </div>

          <div className="rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]">
            <div className="rounded-[16px] p-5 bg-[#1C1C22]/55 border border-white/[0.05]">
              <p className="text-[12.5px] text-[#A1A1AA]">Chi phí Ước tính</p>
              <p className="mt-2 tabular-nums text-[30px] font-semibold tracking-[-0.025em] text-[#0A84FF]">
                {formatUsd(summary.estimatedCostUsd)}
              </p>
              <p className="mt-1 text-[12px] text-[#A1A1AA]">
                Tính theo đơn giá hồ sơ model
              </p>
            </div>
          </div>

          <div className="rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]">
            <div className="rounded-[16px] p-5 bg-[#1C1C22]/55 border border-white/[0.05]">
              <p className="text-[12.5px] text-[#A1A1AA]">Độ trễ Phản hồi TB</p>
              <p className="mt-2 tabular-nums text-[30px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
                {formatNumber(summary.avgLatencyMs)}
                <span className="ml-1 text-[14px] font-normal text-[#A1A1AA]">
                  ms
                </span>
              </p>
              <p className="mt-1 text-[12px] text-[#A1A1AA]">
                Ghi nhận non-blocking 0% ảnh hưởng
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Breakdown by FeatureKey & ModelProfile + Daily Trend */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* FeatureKey Breakdown (2 cols) */}
        <section className="xl:col-span-2 rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]">
          <div className="h-full rounded-[16px] p-6 bg-[#1C1C22]/45 border border-white/[0.05] space-y-4">
            <div>
              <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-[#F5F5F7]">
                Phân rã theo Tính năng (<code className="text-[15px]">FeatureKey</code>)
              </h2>
              <p className="mt-0.5 text-[13px] text-[#A1A1AA]">
                Xác định tính năng nào tiêu thụ token và chi phí cao nhất trong hệ thống.
              </p>
            </div>

            <div className="overflow-x-auto rounded-[12px] border border-white/[0.06]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#121216] text-[11.5px] font-medium uppercase tracking-wider text-[#71717A] border-b border-white/[0.08]">
                    <th className="py-3 px-4">FeatureKey</th>
                    <th className="py-3 px-4 text-right">Requests</th>
                    <th className="py-3 px-4 text-right">Input / Output</th>
                    <th className="py-3 px-4 text-right">Total Tokens</th>
                    <th className="py-3 px-4 text-right">Chi phí (USD)</th>
                    <th className="py-3 px-4 text-right">Latency TB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-[13px]">
                  {byFeature.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-10 px-4 text-center text-[#A1A1AA]"
                      >
                        Chưa có bản ghi `ai_usage_logs` trong khung thời gian đã chọn.
                      </td>
                    </tr>
                  ) : (
                    byFeature.map((item) => {
                      const ratioPct = Math.round(
                        (item.totalTokens / maxFeatureTokens) * 100,
                      );
                      return (
                        <tr key={item.featureKey} className="hover:bg-white/[0.025]">
                          <td className="py-3.5 px-4">
                            <div className="font-mono text-[12.5px] font-medium text-[#F5F5F7]">
                              {item.featureKey}
                            </div>
                            <div className="mt-1.5 h-1.5 w-36 rounded-full bg-white/[0.06] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#0A84FF]"
                                style={{ width: `${Math.max(3, ratioPct)}%` }}
                              />
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right tabular-nums text-[#D4D4D8]">
                            {formatNumber(item.requests)}
                          </td>

                          <td className="py-3.5 px-4 text-right tabular-nums text-[12px] text-[#A1A1AA]">
                            {formatNumber(item.promptTokens)} /{' '}
                            {formatNumber(item.completionTokens)}
                          </td>

                          <td className="py-3.5 px-4 text-right tabular-nums font-medium text-[#F5F5F7]">
                            {formatNumber(item.totalTokens)}
                          </td>

                          <td className="py-3.5 px-4 text-right tabular-nums text-[#0A84FF]">
                            {formatUsd(item.estimatedCostUsd)}
                          </td>

                          <td className="py-3.5 px-4 text-right tabular-nums text-[#D4D4D8]">
                            {formatNumber(item.avgLatencyMs)} ms
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ModelProfile Breakdown + Daily Trend */}
        <section className="rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]">
          <div className="h-full rounded-[16px] p-6 bg-[#1C1C22]/45 border border-white/[0.05] space-y-6">
            <div>
              <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-[#F5F5F7]">
                Phân rã theo <code className="text-[15px]">ModelProfile</code>
              </h2>
              <p className="mt-0.5 text-[13px] text-[#A1A1AA]">
                Đối sánh mức sử dụng giữa các tầng model AI.
              </p>

              <div className="mt-4 space-y-2.5">
                {byProfile.length === 0 ? (
                  <p className="text-[13px] text-[#71717A] py-4">
                    Chưa có dữ liệu hồ sơ model.
                  </p>
                ) : (
                  byProfile.map((prof) => (
                    <div
                      key={prof.profile}
                      className="rounded-[12px] p-3 bg-[#121216] border border-white/[0.06] flex items-center justify-between gap-3"
                    >
                      <div>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${getProfileBadgeStyle(
                            prof.profile,
                          )}`}
                        >
                          {prof.profile}
                        </span>
                        <p className="mt-1 tabular-nums text-[12px] text-[#A1A1AA]">
                          {formatNumber(prof.requests)} req •{' '}
                          {formatNumber(prof.avgLatencyMs)} ms TB
                        </p>
                      </div>
                      <div className="text-right tabular-nums">
                        <p className="text-[13.5px] font-semibold text-[#F5F5F7]">
                          {formatNumber(prof.totalTokens)} tok
                        </p>
                        <p className="text-[11.5px] text-[#0A84FF]">
                          {formatUsd(prof.estimatedCostUsd)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Daily Trend */}
            <div className="pt-4 border-t border-white/[0.08]">
              <h3 className="text-[14px] font-semibold text-[#F5F5F7]">
                Xu hướng Token Theo Ngày
              </h3>
              {dailyTrend.length === 0 ? (
                <p className="mt-2 text-[12.5px] text-[#71717A]">
                  Chưa có chuỗi dữ liệu theo ngày.
                </p>
              ) : (
                <div className="mt-4 flex items-end gap-1.5 h-28 pt-2">
                  {dailyTrend.slice(-14).map((point) => {
                    const heightPct = Math.max(
                      8,
                      Math.round((point.totalTokens / maxDailyTokens) * 100),
                    );
                    return (
                      <div
                        key={point.date}
                        className="flex-1 h-full flex flex-col justify-end items-center group"
                        title={`${point.date}: ${formatNumber(
                          point.totalTokens,
                        )} tokens (${formatNumber(point.requests)} req)`}
                      >
                        <div className="w-full flex-1 flex items-end">
                          <div
                            className="w-full rounded-t-[4px] bg-[#0A84FF]/70 group-hover:bg-[#0A84FF] transition-colors"
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                        <span className="mt-1.5 tabular-nums text-[10px] text-[#71717A]">
                          {point.date.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Recent 20 AI Logs */}
      <section className="rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]">
        <div className="rounded-[16px] p-6 bg-[#1C1C22]/45 border border-white/[0.05] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-[#F5F5F7]">
                Nhật ký 20 Lệnh gọi AI Gần nhất
              </h2>
              <p className="mt-0.5 text-[13px] text-[#A1A1AA]">
                Kiểm chứng trực tiếp dữ liệu từ bảng <code className="text-[#D4D4D8]">ai_usage_logs</code>.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[12px] border border-white/[0.06]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#121216] text-[11.5px] font-medium uppercase tracking-wider text-[#71717A] border-b border-white/[0.08]">
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4">Feature & Profile</th>
                  <th className="py-3 px-4">Model</th>
                  <th className="py-3 px-4">Người dùng</th>
                  <th className="py-3 px-4 text-right">Tokens (In/Out)</th>
                  <th className="py-3 px-4 text-right">Chi phí</th>
                  <th className="py-3 px-4 text-right">Latency</th>
                  <th className="py-3 px-4">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-[13px]">
                {recentLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-10 px-4 text-center text-[#A1A1AA]"
                    >
                      Chưa ghi nhận lệnh gọi AI nào. Hãy thực hiện một lượt Chat hoặc tạo Quiz bên Client để kiểm chứng.
                    </td>
                  </tr>
                ) : (
                  recentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.025]">
                      <td className="py-3 px-4 tabular-nums text-[12px] text-[#A1A1AA] whitespace-nowrap">
                        {formatTime(log.createdAt)}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono text-[12px] text-[#F5F5F7]">
                          {log.featureKey}
                        </div>
                        <span
                          className={`mt-1 inline-flex px-1.5 py-0.5 rounded text-[10.5px] font-medium border ${getProfileBadgeStyle(
                            log.profile,
                          )}`}
                        >
                          {log.profile}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-[12px] text-[#D4D4D8]">
                        {log.modelName}
                      </td>

                      <td className="py-3 px-4 text-[12.5px] text-[#A1A1AA]">
                        {log.userEmail ?? 'System / Worker'}
                      </td>

                      <td className="py-3 px-4 text-right tabular-nums text-[#F5F5F7]">
                        <div>{formatNumber(log.totalTokens)}</div>
                        <div className="text-[11px] text-[#71717A]">
                          {formatNumber(log.promptTokens)} /{' '}
                          {formatNumber(log.completionTokens)}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right tabular-nums text-[#0A84FF]">
                        {formatUsd(log.estimatedCostUsd)}
                      </td>

                      <td className="py-3 px-4 text-right tabular-nums text-[#D4D4D8]">
                        {formatNumber(log.latencyMs)} ms
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                            log.status === 'success'
                              ? 'bg-[#30D158]/15 text-[#30D158] border-[#30D158]/30'
                              : 'bg-[#FF453A]/15 text-[#FF453A] border-[#FF453A]/30'
                          }`}
                        >
                          {log.status}
                        </span>
                        {log.errorMessage && (
                          <p className="mt-1 text-[11px] text-[#FF8A82] max-w-[180px] truncate">
                            {log.errorMessage}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
