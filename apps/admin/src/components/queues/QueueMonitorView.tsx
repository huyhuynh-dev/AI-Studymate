'use client';

import { IconRetry, IconTrash } from '@/components/ui/AdminIcons';
import type { AdminQueueData } from '@/types/admin';

interface QueueMonitorViewProps {
  queueData: AdminQueueData | null;
  actionLoadingId: string | null;
  onRetryJob: (jobId: string) => void;
  onRemoveJob: (jobId: string) => void;
}

function formatNumber(val: number): string {
  return new Intl.NumberFormat('vi-VN').format(val);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTimestamp(ms: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatIsoDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'done':
      return 'bg-[#30D158]/15 text-[#30D158] border-[#30D158]/30';
    case 'active':
    case 'processing':
      return 'bg-[#0A84FF]/15 text-[#0A84FF] border-[#0A84FF]/30';
    case 'failed':
      return 'bg-[#FF453A]/15 text-[#FF453A] border-[#FF453A]/30';
    case 'waiting':
    case 'delayed':
    case 'pending':
      return 'bg-[#FFD60A]/15 text-[#FFD60A] border-[#FFD60A]/30';
    default:
      return 'bg-white/[0.06] text-[#A1A1AA] border-white/[0.08]';
  }
}

export function QueueMonitorView({
  queueData,
  actionLoadingId,
  onRetryJob,
  onRemoveJob,
}: QueueMonitorViewProps) {
  const queue = queueData?.queue;
  const counts = queue?.counts ?? {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    paused: 0,
  };
  const jobs = queue?.jobs ?? [];
  const recentDocuments = queueData?.recentDocuments ?? [];

  const countCards = [
    {
      label: 'Đang chạy (Active)',
      value: counts.active,
      colorClass: 'text-[#0A84FF]',
    },
    {
      label: 'Đang chờ (Waiting)',
      value: counts.waiting,
      colorClass: 'text-[#FFD60A]',
    },
    {
      label: 'Hoàn tất (Lưu 50 gần nhất)',
      value: counts.completed,
      colorClass: 'text-[#30D158]',
    },
    {
      label: 'Thất bại (Failed)',
      value: counts.failed,
      colorClass: 'text-[#FF453A]',
    },
    {
      label: 'Trì hoãn (Delayed)',
      value: counts.delayed,
      colorClass: 'text-[#A1A1AA]',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Queue Status Strip */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium text-[#A1A1AA]">
              Hàng đợi Redis:
            </span>
            <code className="px-2.5 py-1 rounded-[8px] bg-[#121216] border border-white/[0.08] text-[12.5px] font-mono text-[#F5F5F7]">
              {queue?.queueName ?? 'document-processing'}
            </code>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium border ${
                queue?.connected
                  ? 'bg-[#30D158]/15 text-[#30D158] border-[#30D158]/30'
                  : 'bg-[#FF453A]/15 text-[#FF453A] border-[#FF453A]/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  queue?.connected ? 'bg-[#30D158]' : 'bg-[#FF453A]'
                }`}
              />
              {queue?.connected ? 'Redis Connected' : 'Redis Offline'}
            </span>
            {queue?.isPaused && (
              <span className="px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-[#FFD60A]/15 text-[#FFD60A] border border-[#FFD60A]/30">
                Đang tạm dừng (Paused)
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
          {countCards.map((card) => (
            <div
              key={card.label}
              className="rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]"
            >
              <div className="rounded-[16px] p-4 bg-[#1C1C22]/55 border border-white/[0.05]">
                <p className="text-[12px] text-[#A1A1AA]">{card.label}</p>
                <p
                  className={`mt-2 tabular-nums text-[28px] font-semibold tracking-[-0.025em] ${card.colorClass}`}
                >
                  {formatNumber(card.value)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Redis BullMQ Jobs Table */}
      <section className="rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]">
        <div className="rounded-[16px] p-6 bg-[#1C1C22]/45 border border-white/[0.05] space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-[#F5F5F7]">
                Tiến trình Jobs trong Redis BullMQ
              </h2>
              <p className="mt-0.5 text-[13px] text-[#A1A1AA]">
                Cho phép theo dõi retry backoff và kích hoạt chạy lại trực tiếp các job lỗi.
              </p>
            </div>
            <span className="tabular-nums text-[12.5px] text-[#A1A1AA]">
              {formatNumber(jobs.length)} jobs gần nhất
            </span>
          </div>

          <div className="overflow-x-auto rounded-[12px] border border-white/[0.06]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#121216] text-[11.5px] font-medium uppercase tracking-wider text-[#71717A] border-b border-white/[0.08]">
                  <th className="py-3 px-4">Job ID</th>
                  <th className="py-3 px-4">Tài liệu / MIME</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Attempts</th>
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4">Chi tiết lỗi</th>
                  <th className="py-3 px-4 text-right">Điều khiển</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-[13px]">
                {jobs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-10 px-4 text-center text-[#A1A1AA]"
                    >
                      Chưa có job nào đang lưu trong hàng đợi Redis.
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => {
                    const isBusy = actionLoadingId === job.id;
                    return (
                      <tr key={job.id} className="hover:bg-white/[0.025]">
                        <td className="py-3.5 px-4 font-mono text-[12px] text-[#D4D4D8]">
                          #{job.id}
                          <div className="text-[11px] text-[#71717A]">
                            {job.name}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-medium text-[#F5F5F7] max-w-[240px] truncate">
                            {job.fileName || job.documentId || 'Tài liệu'}
                          </div>
                          <div className="text-[11.5px] text-[#71717A] font-mono">
                            {job.mimeType || 'unknown'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-medium border ${getStatusBadgeClass(
                              job.state,
                            )}`}
                          >
                            {job.state}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right tabular-nums text-[#D4D4D8]">
                          {job.attemptsMade} / {job.maxAttempts}
                        </td>

                        <td className="py-3.5 px-4 tabular-nums text-[12px] text-[#A1A1AA]">
                          <div>Tạo: {formatTimestamp(job.timestamp)}</div>
                          {job.finishedOn && (
                            <div className="text-[#71717A]">
                              Xong: {formatTimestamp(job.finishedOn)}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 max-w-[260px]">
                          {job.failedReason ? (
                            <p className="text-[12px] text-[#FF8A82] line-clamp-2">
                              {job.failedReason}
                            </p>
                          ) : (
                            <span className="text-[#71717A]">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            {job.state === 'failed' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => onRetryJob(job.id)}
                                className="spring-interactive min-h-[32px] px-2.5 rounded-[8px] text-[12px] font-medium bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/30 hover:bg-[#0A84FF]/25 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1.5"
                              >
                                <IconRetry className="w-3.5 h-3.5" />
                                <span>Retry</span>
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => onRemoveJob(job.id)}
                              className="spring-interactive min-h-[32px] px-2.5 rounded-[8px] text-[12px] font-medium bg-white/[0.06] text-[#A1A1AA] border border-white/[0.08] hover:bg-[#FF453A]/15 hover:text-[#FF453A] hover:border-[#FF453A]/30 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1.5"
                            >
                              <IconTrash className="w-3.5 h-3.5" />
                              <span>Xóa</span>
                            </button>
                          </div>
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

      {/* PostgreSQL Documents History */}
      <section className="rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]">
        <div className="rounded-[16px] p-6 bg-[#1C1C22]/45 border border-white/[0.05] space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-[#F5F5F7]">
                Đối chiếu Trạng thái Bóc tách & Embedding (PostgreSQL)
              </h2>
              <p className="mt-0.5 text-[13px] text-[#A1A1AA]">
                25 tài liệu tải lên gần nhất kèm trạng thái <code className="text-[#D4D4D8]">ocrStatus</code> và{' '}
                <code className="text-[#D4D4D8]">embedStatus</code>.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[12px] border border-white/[0.06]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#121216] text-[11.5px] font-medium uppercase tracking-wider text-[#71717A] border-b border-white/[0.08]">
                  <th className="py-3 px-4">Tên tài liệu</th>
                  <th className="py-3 px-4">Chủ sở hữu</th>
                  <th className="py-3 px-4 text-right">Kích thước / Trang</th>
                  <th className="py-3 px-4">OCR / Docling</th>
                  <th className="py-3 px-4">Embedding 768d</th>
                  <th className="py-3 px-4">Tải lên</th>
                  <th className="py-3 px-4">Thông báo lỗi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-[13px]">
                {recentDocuments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-10 px-4 text-center text-[#A1A1AA]"
                    >
                      Chưa có tài liệu nào trong cơ sở dữ liệu.
                    </td>
                  </tr>
                ) : (
                  recentDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-white/[0.025]">
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#F5F5F7] max-w-[260px] truncate">
                          {doc.fileName}
                        </div>
                        <div className="text-[11.5px] text-[#71717A] font-mono">
                          {doc.mimeType}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-[12.5px] text-[#A1A1AA]">
                        {doc.userEmail ?? '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right tabular-nums text-[#D4D4D8]">
                        <div>{formatBytes(doc.fileSizeBytes)}</div>
                        <div className="text-[11.5px] text-[#71717A]">
                          {doc.pageCount ? `${doc.pageCount} trang` : '—'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-medium border ${getStatusBadgeClass(
                            doc.ocrStatus,
                          )}`}
                        >
                          {doc.ocrStatus}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-medium border ${getStatusBadgeClass(
                            doc.embedStatus,
                          )}`}
                        >
                          {doc.embedStatus}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 tabular-nums text-[12px] text-[#A1A1AA]">
                        {formatIsoDateTime(doc.uploadedAt)}
                      </td>

                      <td className="py-3.5 px-4 max-w-[240px]">
                        {doc.processingError ? (
                          <p className="text-[12px] text-[#FF8A82] line-clamp-2">
                            {doc.processingError}
                          </p>
                        ) : (
                          <span className="text-[#71717A]">—</span>
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
