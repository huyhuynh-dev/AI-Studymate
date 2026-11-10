import useSWR from "swr";
import { conversationsApi } from "@/services/conversations.api";
import { Conversation } from "@/types";

export function useConversations(subjectId?: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Conversation[]>(
    subjectId ? `/subjects/${subjectId}/conversations` : null,
    () => conversationsApi.getBySubjectId(subjectId!)
  );

  const createSession = async (title: string) => {
    if (!subjectId) return;
    const newSession = await conversationsApi.create({ subject_id: subjectId, title });
    mutate(data ? [newSession, ...data] : [newSession], { revalidate: false });
    return newSession;
  };

  const updateSession = async (id: string, title: string) => {
    const updated = await conversationsApi.updateTitle(id, title);
    mutate(data?.map((c) => (c.id === id ? updated : c)), { revalidate: false });
  };

  const deleteSession = async (id: string) => {
    await conversationsApi.delete(id);
    mutate(data?.filter((c) => c.id !== id), { revalidate: false });
  };

  return {
    conversations: data || [],
    isLoading,
    error,
    createSession,
    updateSession,
    deleteSession,
    refresh: mutate,
  };
}
