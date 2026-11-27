import { tool } from 'ai';
import { z } from 'zod';
import { requiresUserApproval } from '../../../utils/risk-gate.helper.js';
import type {
  ManageWorkspaceAndJobsCallback,
  ManageWorkspaceAndJobsToolInput,
  ManageWorkspaceAndJobsToolOutput,
  ToolCallTracker,
} from '../../types.js';

export const manageWorkspaceAndJobsInputSchema = z.object({
  action: z
    .enum([
      'navigate',
      'get_preferences',
      'update_preferences',
      'list_action_history',
      'undo_action',
      'enqueue_background_job',
      'list_jobs',
      'get_job_status',
      'retry_job',
      'cancel_job',
    ])
    .describe(
      'Điều khiển Workspace, Cài đặt cá nhân, Lịch sử/Undo, và Tác vụ nền BullMQ.',
    ),
  navigationTarget: z
    .object({
      page: z.enum(['home', 'subject', 'conversation', 'profile']).optional(),
      subjectId: z.string().optional(),
      conversationId: z.string().optional(),
      tab: z
        .enum(['documents', 'summary', 'flashcard', 'quiz', 'analytics'])
        .optional(),
      resourceType: z.enum(['document', 'summary', 'deck', 'quiz']).optional(),
      resourceId: z.string().optional(),
    })
    .optional()
    .describe('Đích điều hướng trên giao diện (dùng cho navigate).'),
  theme: z
    .enum(['system', 'light', 'dark'])
    .optional()
    .describe('Chế độ giao diện sáng/tối (dùng cho update_preferences).'),
  aiResponseLanguage: z
    .enum(['auto', 'vi', 'en'])
    .optional()
    .describe('Ngôn ngữ phản hồi ưu tiên của AI (dùng cho update_preferences).'),
  dailyGoalMinutes: z
    .number()
    .int()
    .min(5)
    .max(240)
    .optional()
    .describe('Mục tiêu học mỗi ngày tính bằng phút (5..240, dùng cho update_preferences).'),
  actionLogId: z
    .string()
    .optional()
    .describe('UUID nhật ký hành động cần hoàn tác (bỏ trống sẽ hoàn tác thao tác gần nhất trong phiên học cho undo_action).'),
  jobType: z
    .enum([
      'bulk_flashcards',
      'bulk_quiz',
      'deep_multi_doc_summary',
      'batch_study_workflow',
    ])
    .optional()
    .describe('Loại tác vụ nền cần chạy bất đồng bộ (cho enqueue_background_job).'),
  jobTitle: z
    .string()
    .max(255)
    .optional()
    .describe('Tiêu đề hiển thị trên Job Tray (cho enqueue_background_job).'),
  documentIds: z
    .array(z.string())
    .max(50)
    .optional()
    .describe('Danh sách documentIds đầu vào cho tác vụ nền.'),
  count: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe('Tổng số thẻ flashcard hoặc số câu hỏi quiz mục tiêu cho tác vụ nền.'),
  deckName: z.string().max(255).optional(),
  instructions: z.string().max(2000).optional(),
  jobId: z
    .string()
    .optional()
    .describe('UUID tác vụ nền (cho get_job_status, retry_job, cancel_job).'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .describe('Số bản ghi tối đa cần lấy (cho list_action_history, list_jobs).'),
});

export function toManageWorkspaceAndJobsLightweightOutput(
  output?: ManageWorkspaceAndJobsToolOutput,
): Record<string, unknown> | undefined {
  if (!output) return undefined;
  return {
    ok: output.ok,
    action: output.action,
    riskTier: output.riskTier,
    actionLogId: output.actionLogId,
    undoable: output.undoable,
    jobId: output.jobId,
    jobStatus: output.jobStatus,
    preferences: output.preferences,
    message: output.message,
  };
}

export function createManageWorkspaceAndJobsTool(
  callback: ManageWorkspaceAndJobsCallback,
  tracker?: ToolCallTracker,
) {
  return tool({
    description:
      'Navigate workspace tabs/pages/resources in real time, read or update user settings (Light/Dark theme, AI response language, daily study goal), inspect/undo recent AI actions, or enqueue/monitor/retry/cancel async BullMQ background jobs for heavy multi-document tasks (> 30 flashcards, > 20 quiz questions, >= 4 documents deep synthesis, or multi-artifact workflows).',
    inputSchema: manageWorkspaceAndJobsInputSchema,
    needsApproval: (input) =>
      requiresUserApproval('manageWorkspaceAndJobs', input),
    execute: async (
      input: ManageWorkspaceAndJobsToolInput,
      { toolCallId },
    ): Promise<ManageWorkspaceAndJobsToolOutput> => {
      const output = await callback(input, toolCallId);
      if (toolCallId && tracker) {
        tracker.recordOutput(
          toolCallId,
          'manageWorkspaceAndJobs',
          output,
          toManageWorkspaceAndJobsLightweightOutput(output),
        );
      }
      return output;
    },
    toModelOutput: ({ output }) => ({
      type: 'text',
      value: JSON.stringify(output ?? {}),
    }),
  });
}
