import { axiosClient } from "@/lib/axios.client";
import { blobToBase64 } from "@/services/documents.api";
import type { UIMessage } from "ai";
import type { ChatSession } from "@/hooks/useChatSessions";

export interface CreateChatSessionParams {
  conversation_id: string;
  title: string;
}

export interface UpdateChatSessionParams {
  title: string;
}

export interface GenerateSuggestionsParams {
  lastAssistantResponse: string;
  lastUserQuestion?: string;
}

export interface AgentActionLogItem {
  id: string;
  toolName: string;
  action: string;
  riskTier: "tier_0" | "tier_1" | "tier_2";
  status: string;
  targetType?: string | null;
  targetId?: string | null;
  summary?: string | null;
  createdAt: string;
}

export interface TranscribeAudioParams {
  audioBlob: Blob;
  language?: string;
  signal?: AbortSignal;
}

export interface TranscribeAudioResult {
  text: string;
  language: string | null;
  durationInSeconds: number | null;
}

interface RawTranscribeAudioResponse {
  text?: string | null;
  language?: string | null;
  durationInSeconds?: number | null;
  duration_in_seconds?: number | null;
}

function mapTranscribeAudioResponse(
  raw: RawTranscribeAudioResponse | null | undefined,
): TranscribeAudioResult {
  const duration = raw?.durationInSeconds ?? raw?.duration_in_seconds;
  return {
    text: typeof raw?.text === "string" ? raw.text.trim() : "",
    language:
      typeof raw?.language === "string" && raw.language.trim()
        ? raw.language.trim()
        : null,
    durationInSeconds:
      typeof duration === "number" && Number.isFinite(duration)
        ? duration
        : null,
  };
}

export const chatSessionsApi = {
  /**
   * Lấy danh sách các phiên trò chuyện thuộc một Conversation.
   * Kết quả được sắp xếp theo `created_at` giảm dần từ Backend.
   * GET /api/proxy/chat-agent/conversations/{conversationId}/sessions
   */
  async getByConversationId(conversationId: string): Promise<ChatSession[]> {
    const response = await axiosClient.get<ChatSession[]>(
      `/chat-agent/conversations/${conversationId}/sessions`
    );
    return response.data;
  },

  /**
   * Lấy chi tiết một phiên trò chuyện theo ID.
   * GET /api/proxy/chat-agent/sessions/{id}
   */
  async getById(id: string): Promise<ChatSession> {
    const response = await axiosClient.get<ChatSession>(
      `/chat-agent/sessions/${id}`
    );
    return response.data;
  },

  /**
   * Lấy danh sách tin nhắn cũ của một ChatSession.
   * GET /api/proxy/chat-agent/sessions/{id}/messages
   */
  async getMessages(sessionId: string): Promise<UIMessage[]> {
    const response = await axiosClient.get<UIMessage[]>(
      `/chat-agent/sessions/${sessionId}/messages`
    );
    return response.data;
  },

  /**
   * Tạo một phiên trò chuyện mới trong một Conversation.
   * POST /api/proxy/chat-agent/conversations/{conversationId}/sessions
   *
   * Ghi chú: Backend từ chối nếu body chứa các field ngoài DTO,
   * vì vậy chỉ gửi `{ title }` trong body request.
   */
  async create({ conversation_id, title }: CreateChatSessionParams): Promise<ChatSession> {
    const response = await axiosClient.post<ChatSession>(
      `/chat-agent/conversations/${conversation_id}/sessions`,
      { title: title.trim().slice(0, 255) }
    );
    return response.data;
  },

  /**
   * Cập nhật tiêu đề phiên trò chuyện.
   * PATCH /api/proxy/chat-agent/sessions/{id}
   */
  async updateTitle(id: string, title: string): Promise<ChatSession> {
    const response = await axiosClient.patch<ChatSession>(
      `/chat-agent/sessions/${id}`,
      { title: title.trim().slice(0, 255) }
    );
    return response.data;
  },

  /**
   * Xóa một phiên trò chuyện.
   * DELETE /api/proxy/chat-agent/sessions/{id}
   *
   * Xóa ChatSession sẽ cascade xóa các message liên quan.
   */
  async delete(id: string): Promise<void> {
    await axiosClient.delete(`/chat-agent/sessions/${id}`);
  },

  /**
   * Sinh 2-3 câu hỏi gợi ý tiếp nối (Follow-up Questions) sau khi AI trả lời xong.
   * POST /api/proxy/chat-agent/sessions/{id}/suggestions
   */
  async generateSuggestions(
    sessionId: string,
    params: GenerateSuggestionsParams
  ): Promise<string[]> {
    const response = await axiosClient.post<{ suggestions: string[] }>(
      `/chat-agent/sessions/${sessionId}/suggestions`,
      params
    );
    return Array.isArray(response.data?.suggestions)
      ? response.data.suggestions
      : [];
  },

  /**
   * Lấy danh sách lịch sử hành động AI (AgentActionLog) trong một Conversation.
   * GET /api/proxy/chat-agent/conversations/{conversationId}/actions
   */
  async listAgentActions(conversationId: string): Promise<AgentActionLogItem[]> {
    const response = await axiosClient.get<
      AgentActionLogItem[] | { actions?: AgentActionLogItem[] }
    >(`/chat-agent/conversations/${conversationId}/actions`);
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return Array.isArray(response.data?.actions) ? response.data.actions : [];
  },

  /**
   * Hoàn tác một hành động thay đổi dữ liệu của AI theo actionLogId.
   * POST /api/proxy/chat-agent/actions/{actionLogId}/undo
   */
  async undoAgentAction(
    actionLogId: string,
  ): Promise<{ success: boolean; message?: string }> {
    const response = await axiosClient.post<{
      success: boolean;
      message?: string;
    }>(`/chat-agent/actions/${actionLogId}/undo`);
    return response.data;
  },

  /**
   * Chuyển đổi đoạn âm thanh ghi âm từ Micro thành văn bản (STT).
   * POST /api/proxy/chat-agent/transcribe
   */
  async transcribeAudio({
    audioBlob,
    language,
    signal,
  }: TranscribeAudioParams): Promise<TranscribeAudioResult> {
    const audioBase64 = await blobToBase64(audioBlob);
    const mimeType = audioBlob.type || "audio/webm";
    const response = await axiosClient.post<RawTranscribeAudioResponse>(
      "/chat-agent/transcribe",
      {
        audioBase64,
        mimeType,
        ...(language?.trim() ? { language: language.trim() } : {}),
      },
      { signal },
    );
    return mapTranscribeAudioResponse(response.data);
  },
};
