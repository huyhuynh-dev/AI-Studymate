"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  agentJobsApi,
  type AgentBackgroundJobDto,
} from "@/services/agentJobs.api";
import { publishWorkspaceSync } from "@/lib/workspace-sync";

export interface UseAgentJobsResult {
  jobs: AgentBackgroundJobDto[];
  activeJobsCount: number;
  latestNotification: {
    jobId: string;
    title: string;
    status: "completed" | "failed";
    message: string;
  } | null;
  dismissNotification: () => void;
  refreshJobs: () => Promise<void>;
  retryJob: (jobId: string) => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
}

export function useAgentJobs(conversationId?: string | null): UseAgentJobsResult {
  const prevStatusMapRef = useRef<Map<string, AgentBackgroundJobDto["status"]>>(
    new Map(),
  );
  const [latestNotification, setLatestNotification] =
    useState<UseAgentJobsResult["latestNotification"]>(null);

  const swrKey = conversationId
    ? `/chat-agent/jobs?conversationId=${conversationId}`
    : null;

  const { data: jobs = [], mutate } = useSWR<AgentBackgroundJobDto[]>(
    swrKey,
    () =>
      conversationId
        ? agentJobsApi.listByConversation(conversationId)
        : Promise.resolve([]),
    {
      refreshInterval: (latestData) => {
        const hasActive = Array.isArray(latestData)
          ? latestData.some(
              (j) => j.status === "queued" || j.status === "running",
            )
          : false;
        return hasActive ? 5000 : 0;
      },
      revalidateOnFocus: true,
    },
  );

  const activeJobsCount = useMemo(
    () =>
      jobs.filter((j) => j.status === "queued" || j.status === "running")
        .length,
    [jobs],
  );

  const applyTerminalTransitions = useCallback(
    (nextJobs: AgentBackgroundJobDto[]) => {
      for (const job of nextJobs) {
        const prev = prevStatusMapRef.current.get(job.id);
        prevStatusMapRef.current.set(job.id, job.status);

        if (
          prev &&
          (prev === "queued" || prev === "running") &&
          (job.status === "completed" || job.status === "failed")
        ) {
          setLatestNotification({
            jobId: job.id,
            title: job.title,
            status: job.status,
            message:
              job.status === "completed"
                ? `Tác vụ nền "${job.title}" đã hoàn tất!`
                : `Tác vụ nền "${job.title}" gặp sự cố: ${job.errorMessage || "Lỗi xử lý"}`,
          });

          if (job.status === "completed" && conversationId) {
            const payload = job.resultPayload ?? {};
            const entityId =
              (typeof payload.deckId === "string" && payload.deckId) ||
              (typeof payload.summaryId === "string" && payload.summaryId) ||
              (typeof payload.quizId === "string" && payload.quizId) ||
              job.id;

            if (job.jobType === "bulk_flashcards") {
              publishWorkspaceSync({
                resource: "flashcard",
                action: "created",
                conversationId,
                entityId,
                targetKind: "new",
                title: job.title,
                occurredAt: new Date().toISOString(),
              });
            } else if (job.jobType === "bulk_quiz") {
              publishWorkspaceSync({
                resource: "quiz",
                action: "created",
                conversationId,
                entityId,
                title: job.title,
                occurredAt: new Date().toISOString(),
              });
            } else if (job.jobType === "bulk_summary") {
              publishWorkspaceSync({
                resource: "summary",
                action: "created",
                conversationId,
                entityId,
                title: job.title,
                occurredAt: new Date().toISOString(),
              });
            }
          }
        }
      }
    },
    [conversationId],
  );

  useEffect(() => {
    applyTerminalTransitions(jobs);
  }, [jobs, applyTerminalTransitions]);

  useEffect(() => {
    if (!conversationId || typeof window === "undefined") return;
    if (typeof EventSource === "undefined") return;

    const es = new EventSource(
      `/api/proxy/chat-agent/jobs/stream?conversationId=${encodeURIComponent(conversationId)}`,
    );

    const handleJobEvent = () => {
      void mutate();
    };

    es.addEventListener("job_progress", handleJobEvent);
    es.addEventListener("job_completed", handleJobEvent);
    es.addEventListener("job_failed", handleJobEvent);
    es.onmessage = handleJobEvent;

    return () => {
      es.close();
    };
  }, [conversationId, mutate]);

  const refreshJobs = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const retryJob = useCallback(
    async (jobId: string) => {
      await agentJobsApi.retry(jobId);
      await mutate();
    },
    [mutate],
  );

  const cancelJob = useCallback(
    async (jobId: string) => {
      await agentJobsApi.cancel(jobId);
      await mutate();
    },
    [mutate],
  );

  const dismissNotification = useCallback(() => {
    setLatestNotification(null);
  }, []);

  return {
    jobs,
    activeJobsCount,
    latestNotification,
    dismissNotification,
    refreshJobs,
    retryJob,
    cancelJob,
  };
}
