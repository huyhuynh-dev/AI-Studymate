import { isAxiosError } from "axios";
import { axiosClient } from "@/lib/axios.client";

export type AgentBackgroundJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface AgentBackgroundJobDto {
  id: string;
  conversationId: string;
  jobType: string;
  status: AgentBackgroundJobStatus;
  progress: number;
  currentStep?: string | null;
  title: string;
  errorMessage?: string | null;
  resultPayload?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

interface RawAgentJobResponse {
  id: string;
  conversation_id?: string;
  conversationId?: string;
  job_type?: string;
  jobType?: string;
  status: AgentBackgroundJobStatus;
  progress?: number;
  current_step?: string | null;
  currentStep?: string | null;
  title?: string;
  error_message?: string | null;
  errorMessage?: string | null;
  result_payload?: Record<string, unknown> | null;
  resultPayload?: Record<string, unknown> | null;
  created_at?: string | Date;
  createdAt?: string | Date;
  updated_at?: string | Date;
  updatedAt?: string | Date;
  completed_at?: string | Date | null;
  completedAt?: string | Date | null;
}

function toIsoString(val: string | Date | null | undefined): string {
  if (!val) return new Date().toISOString();
  return typeof val === "string" ? val : val.toISOString();
}

function mapJob(raw: RawAgentJobResponse): AgentBackgroundJobDto {
  return {
    id: raw.id,
    conversationId: raw.conversationId ?? raw.conversation_id ?? "",
    jobType: raw.jobType ?? raw.job_type ?? "bulk_flashcards",
    status: raw.status,
    progress: typeof raw.progress === "number" ? raw.progress : 0,
    currentStep: raw.currentStep ?? raw.current_step ?? null,
    title: raw.title ?? "Tác vụ nền AI",
    errorMessage: raw.errorMessage ?? raw.error_message ?? null,
    resultPayload: raw.resultPayload ?? raw.result_payload ?? null,
    createdAt: toIsoString(raw.createdAt ?? raw.created_at),
    updatedAt: toIsoString(raw.updatedAt ?? raw.updated_at),
    completedAt:
      raw.completedAt || raw.completed_at
        ? toIsoString(raw.completedAt ?? raw.completed_at)
        : null,
  };
}

function extractApiError(error: unknown, fallback: string): Error {
  if (isAxiosError(error)) {
    const msg = (error.response?.data as { message?: string } | undefined)
      ?.message;
    return new Error(msg || fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
}

export const agentJobsApi = {
  async listByConversation(
    conversationId: string,
  ): Promise<AgentBackgroundJobDto[]> {
    try {
      const res = await axiosClient.get<
        RawAgentJobResponse[] | { jobs?: RawAgentJobResponse[] }
      >("/chat-agent/jobs", {
        params: { conversationId },
      });
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.jobs)
          ? res.data.jobs
          : [];
      return list.map(mapJob);
    } catch (error) {
      throw extractApiError(error, "Không thể tải danh sách tác vụ nền.");
    }
  },

  async retry(jobId: string): Promise<AgentBackgroundJobDto> {
    try {
      const res = await axiosClient.post<RawAgentJobResponse>(
        `/chat-agent/jobs/${jobId}/retry`,
      );
      return mapJob(res.data);
    } catch (error) {
      throw extractApiError(error, "Không thể thử lại tác vụ nền.");
    }
  },

  async cancel(jobId: string): Promise<AgentBackgroundJobDto> {
    try {
      const res = await axiosClient.post<RawAgentJobResponse>(
        `/chat-agent/jobs/${jobId}/cancel`,
      );
      return mapJob(res.data);
    } catch (error) {
      throw extractApiError(error, "Không thể hủy tác vụ nền.");
    }
  },
};
