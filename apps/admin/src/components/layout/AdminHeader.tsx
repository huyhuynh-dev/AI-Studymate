'use client';

import { IconPlay, IconRefresh } from '@/components/ui/AdminIcons';
import type { AdminOverviewData, AdminTabKey } from '@/types/admin';

interface AdminHeaderProps {
  activeTab: AdminTabKey;
  health: AdminOverviewData['health'] | null;
  lastSyncedAt: string | null;
  isRefreshing: boolean;
  isRunningBenchmark: boolean;
  autoRefreshQueues: boolean;
  onToggleAutoRefresh: (next: boolean) => void;
  onRefresh: () => void;
  onRunBenchmark: () => void;
}

const TAB_TITLES: Record<AdminTabKey, { title: string; subtitle: string }> = {
  overview: {
    title: 'Tổng quan Hệ thống & Quản lý Người dùng',
    subtitle: 'Theo dõi sức khỏe hạ tầng, học liệu Vector và phân quyền tài khoản.',
  },
  queues: {
    title: 'Giám sát Hàng đợi BullMQ & Pipeline Tài liệu',
    subtitle: 'Trạng thái Redis document-processing, retry và đối chiếu bóc tách Docling.',
  },
  'ai-telemetry': {
    title: 'Giám sát Lưu lượng Token & Chi phí AI',
    subtitle: 'Đo lường Prompt/Completion Tokens, chi phí USD và độ trễ theo FeatureKey.',
  },
  'rag-benchmark': {
    title: 'Thực nghiệm Định lượng RAG (Ablation Study)',
    subtitle: 'So sánh định lượng 4 chế độ trên Golden Dataset: Vector vs Keyword vs Hybrid vs 5-Step Rerank.',
  },
};

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'Chưa đồng bộ';
  const date = new Date(iso);
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function AdminHeader({
  activeTab,
  health,
  lastSyncedAt,
  isRefreshing,
  isRunningBenchmark,
  autoRefreshQueues,
  onToggleAutoRefresh,
  onRefresh,
  onRunBenchmark,
}: AdminHeaderProps) {
  const meta = TAB_TITLES[activeTab];
  const isBenchmarkTab = activeTab === 'rag-benchmark';

  return (
    <header className="apple-liquid-glass sticky top-0 z-20 px-6 py-4 border-b border-white/[0.08]">
      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[20px] md:text-[22px] font-semibold tracking-[-0.02em] leading-tight text-[#F5F5F7]">
            {meta.title}
          </h1>
          <p className="mt-1 text-[13.5px] text-[#A1A1AA] truncate">
            {meta.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Health Badges */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#121216] border border-white/[0.08] text-[12px]">
            <span className="flex items-center gap-1.5 text-[#A1A1AA]">
              <span
                className={`w-2 h-2 rounded-full ${
                  health?.database === 'up'
                    ? 'bg-[#30D158]'
                    : health?.database === 'down'
                      ? 'bg-[#FF453A]'
                      : 'bg-[#71717A]'
                }`}
              />
              <span>PostgreSQL</span>
            </span>
            <span className="text-white/15">•</span>
            <span className="flex items-center gap-1.5 text-[#A1A1AA]">
              <span
                className={`w-2 h-2 rounded-full ${
                  health?.redis === 'up'
                    ? 'bg-[#30D158]'
                    : health?.redis === 'down'
                      ? 'bg-[#FF453A]'
                      : 'bg-[#71717A]'
                }`}
              />
              <span>Redis BullMQ</span>
            </span>
          </div>

          <span className="tabular-nums text-[12px] text-[#71717A] hidden sm:inline">
            Đồng bộ: {formatSyncTime(lastSyncedAt)}
          </span>

          {activeTab === 'queues' && (
            <button
              type="button"
              onClick={() => onToggleAutoRefresh(!autoRefreshQueues)}
              className={`spring-interactive min-h-[36px] px-3 rounded-[10px] text-[12.5px] font-medium border active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF] ${
                autoRefreshQueues
                  ? 'bg-[#30D158]/15 text-[#30D158] border-[#30D158]/30'
                  : 'bg-white/[0.05] text-[#A1A1AA] border-white/[0.08] hover:bg-white/[0.09]'
              }`}
            >
              Auto-Refresh 15s: {autoRefreshQueues ? 'BẬT' : 'TẮT'}
            </button>
          )}

          {/* Khi ở tab Benchmark, nút Làm mới chuyển thành Secondary để giữ đúng 1 Primary CTA */}
          {isBenchmarkTab ? (
            <>
              <button
                type="button"
                disabled={isRefreshing || isRunningBenchmark}
                onClick={onRefresh}
                className="spring-interactive min-h-[38px] px-3.5 rounded-[11px] text-[13px] font-medium bg-white/[0.06] text-[#F5F5F7] border border-white/[0.1] hover:bg-white/[0.11] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-2"
              >
                <IconRefresh
                  className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                />
                <span>Tải lại</span>
              </button>

              <button
                type="button"
                disabled={isRunningBenchmark}
                onClick={onRunBenchmark}
                className="spring-interactive min-h-[38px] px-4 rounded-[11px] text-[13px] font-semibold bg-[#0A84FF] text-white hover:bg-[#0A84FF]/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-2"
              >
                <IconPlay className="w-4 h-4" />
                <span>
                  {isRunningBenchmark
                    ? 'Đang chạy Benchmark...'
                    : 'Chạy lại Thực nghiệm RAG'}
                </span>
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={isRefreshing}
              onClick={onRefresh}
              className="spring-interactive min-h-[38px] px-4 rounded-[11px] text-[13px] font-semibold bg-[#0A84FF] text-white hover:bg-[#0A84FF]/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-2"
            >
              <IconRefresh
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshing ? 'Đang đồng bộ...' : 'Làm mới dữ liệu'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
