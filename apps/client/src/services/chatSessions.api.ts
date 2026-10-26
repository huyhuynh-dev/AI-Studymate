import { axiosClient } from "@/lib/axios.client";
import type { UIMessage } from "ai";
import type { ChatSession } from "@/hooks/useChatSessions";

export interface CreateChatSessionParams {
  conversation_id: string;
  title: string;
}

export interface UpdateChatSessionParams {
  title: string;
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
};
