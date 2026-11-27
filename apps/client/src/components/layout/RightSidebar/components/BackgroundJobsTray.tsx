"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCw,
  X,
} from "lucide-react";
import type { AgentBackgroundJobDto } from "@/services/agentJobs.api";

export interface BackgroundJobsTrayProps {
  jobs: AgentBackgroundJobDto[];
  activeCount: number;
  onRetryJob: (jobId: string) => Promise<void>;
  onCancelJob: (jobId: string) => Promise<void>;
}

const STATUS_LABEL: Record<AgentBackgroundJobDto["status"], string> = {
  queued: "Đang chờ xử lý",
  running: "Đang chạy nền",
  completed: "Hoàn thành",
  failed: "Thất bại",
  cancelled: "Đã hủy",
};

export function BackgroundJobsTray({
  jobs,
  activeCount,
  onRetryJob,
  onCancelJob,
}: BackgroundJobsTrayProps) {
  const [open, setOpen] = useState(false);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);

  if (jobs.length === 0) {
    return null;
  }

  const handleAction = async (
    jobId: string,
    fn: (id: string) => Promise<void>,
  ) => {
    setBusyJobId(jobId);
    try {
      await fn(jobId);
    } finally {
      setBusyJobId(null);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title="Theo dõi các tác vụ AI chạy nền"
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl border border-[#E5EEFF] dark:border-white/[0.1] bg-[#F8F9FF] dark:bg-white/[0.04] px-2.5 text-[11px] font-semibold text-[#0B1C30] dark:text-[#EFF0F6] hover:border-[#4F46E5]/50 transition-colors"
      >
        {activeCount > 0 ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#4F46E5] dark:text-[#818CF8]" />
        ) : (
          <Clock className="h-3.5 w-3.5 text-[#777587] dark:text-neutral-400" />
        )}
        <span>{activeCount > 0 ? `${activeCount} đang chạy` : `${jobs.length} tác vụ`}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-2xl border border-[#E5EEFF] dark:border-white/[0.1] bg-white dark:bg-[#161922] p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between border-b border-[#E5EEFF] dark:border-white/[0.08] pb-2">
            <span className="text-xs font-bold text-[#0B1C30] dark:text-white">
              Tác vụ nền ({jobs.length})
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-[#777587] hover:bg-[#F3F4F6] dark:hover:bg-white/[0.06] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto pr-0.5">
            {jobs.map((job) => {
              const isActive =
                job.status === "queued" || job.status === "running";
              const isBusy = busyJobId === job.id;
              return (
                <div
                  key={job.id}
                  className="rounded-xl border border-[#E5EEFF] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-white/[0.03] p-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[#0B1C30] dark:text-white">
                        {job.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-[#777587] dark:text-neutral-400">
                        {isActive && (
                          <Loader2 className="h-3 w-3 animate-spin text-[#4F46E5]" />
                        )}
                        {job.status === "completed" && (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        )}
                        {job.status === "failed" && (
                          <AlertCircle className="h-3 w-3 text-rose-500" />
                        )}
                        <span>{STATUS_LABEL[job.status]}</span>
                        {isActive && <span>· {job.progress}%</span>}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {job.status === "failed" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleAction(job.id, onRetryJob)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#4F46E5] px-2 py-1 text-[10.5px] font-semibold text-white hover:bg-[#4338CA] disabled:opacity-50"
                        >
                          <RotateCw className="h-3 w-3" />
                          <span>Thử lại</span>
                        </button>
                      )}
                      {isActive && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleAction(job.id, onCancelJob)}
                          className="rounded-lg border border-[#E5EEFF] dark:border-white/[0.1] px-2 py-1 text-[10.5px] font-semibold text-[#777587] hover:text-rose-500 disabled:opacity-50 cursor-pointer"
                        >
                          Hủy
                        </button>
                      )}
                    </div>
                  </div>

                  {isActive && (
                    <div className="mt-2 space-y-1">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5EEFF] dark:bg-white/[0.08]">
                        <div
                          className="h-full rounded-full bg-[#4F46E5] transition-all duration-300"
                          style={{
                            width: `${Math.max(4, Math.min(100, job.progress))}%`,
                          }}
                        />
                      </div>
                      {job.currentStep && (
                        <p className="truncate text-[10px] text-[#777587] dark:text-neutral-400">
                          {job.currentStep}
                        </p>
                      )}
                    </div>
                  )}

                  {job.status === "failed" && job.errorMessage && (
                    <p className="mt-1 text-[10.5px] text-rose-600 dark:text-rose-400">
                      {job.errorMessage}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
