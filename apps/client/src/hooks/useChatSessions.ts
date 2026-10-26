import useSWR from "swr";
import { chatSessionsApi } from "@/services/chatSessions.api";

/**
 * Khớp bảng `chat_sessions` trong Prisma.
 * Nếu dự án đã có type ChatSession trong "@/types" thì xóa interface này và import từ đó.
 */
export interface ChatSession {
  id: string;
  conversation_id: string;
  title: string;
  created_at: string;
}

/**
 * Quản lý danh sách ChatSession (đoạn chat) thuộc một Conversation.
 *
 * `chatSessionsApi` cần có 4 hàm sau (tạo file services/chatSessions.api.ts
 * theo mẫu của conversations.api.ts):
 *   - getByConversationId(conversationId: string): Promise<ChatSession[]>   // mới nhất trước
 *   - create({ conversation_id, title }): Promise<ChatSession>
 *   - updateTitle(id: string, title: string): Promise<ChatSession>
 *   - delete(id: string): Promise<void>   // xóa ChatSession → cascade xóa Message
 */
export function useChatSessions(conversationId?: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ChatSession[]>(
    conversationId ? `/conversations/${conversationId}/chat-sessions` : null,
    () => chatSessionsApi.getByConversationId(conversationId!)
  );

  const createSession = async (title: string) => {
    if (!conversationId) return;
    const created = await chatSessionsApi.create({
      conversation_id: conversationId,
      title,
    });
    mutate((current) => (current ? [created, ...current] : [created]), {
      revalidate: false,
    });
    return created;
  };

  const updateSession = async (id: string, title: string) => {
    await chatSessionsApi.updateTitle(id, title);
    mutate((current) => current?.map((s) => (s.id === id ? { ...s, title } : s)), {
      revalidate: false,
    });
  };

  const deleteSession = async (id: string) => {
    await chatSessionsApi.delete(id);
    mutate((current) => current?.filter((s) => s.id !== id), {
      revalidate: false,
    });
  };

  return {
    chatSessions: data || [],
    isLoading,
    error,
    createSession,
    updateSession,
    deleteSession,
    refresh: mutate,
  };
}
