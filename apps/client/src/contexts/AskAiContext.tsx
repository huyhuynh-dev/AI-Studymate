"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export interface AskAiSelectionSource {
  documentId?: string;
  fileName?: string;
  mode?: string;
}

export interface AskAiSelectionRequest {
  selectedText: string;
  prompt: string;
  source?: AskAiSelectionSource;
  nonce: number;
}

export type AskAiSelectionPayload = Omit<AskAiSelectionRequest, 'nonce'>;

export interface AskAiContextValue {
  /** Yêu cầu Hỏi AI từ vùng văn bản đang chọn chờ RightSidebar tiếp nhận và gửi */
  pendingAskRequest: AskAiSelectionRequest | null;
  /** Trạng thái RightSidebar AI đang stream phản hồi câu trước */
  isAiResponding: boolean;
  /** Gửi đoạn bôi đen + prompt từ Editor sang RightSidebar */
  askAiAboutSelection: (payload: AskAiSelectionPayload) => void;
  /** Đánh dấu RightSidebar đã tiếp nhận và chuyển vào hàng đợi gửi tin nhắn */
  consumeAskRequest: () => void;
  /** Đồng bộ trạng thái bận của chatbox từ RightSidebar */
  setIsAiResponding: (busy: boolean) => void;
}

const AskAiContext = createContext<AskAiContextValue>({
  pendingAskRequest: null,
  isAiResponding: false,
  askAiAboutSelection: () => {},
  consumeAskRequest: () => {},
  setIsAiResponding: () => {},
});

export function AskAiProvider({ children }: { children: React.ReactNode }) {
  const [pendingAskRequest, setPendingAskRequest] =
    useState<AskAiSelectionRequest | null>(null);
  const [isAiResponding, setIsAiRespondingState] = useState(false);

  const askAiAboutSelection = useCallback((payload: AskAiSelectionPayload) => {
    if (!payload.selectedText.trim() || !payload.prompt.trim()) {
      return;
    }
    setPendingAskRequest({
      ...payload,
      nonce: Date.now(),
    });
  }, []);

  const consumeAskRequest = useCallback(() => {
    setPendingAskRequest(null);
  }, []);

  const setIsAiResponding = useCallback((busy: boolean) => {
    setIsAiRespondingState(busy);
  }, []);

  const contextValue = useMemo<AskAiContextValue>(
    () => ({
      pendingAskRequest,
      isAiResponding,
      askAiAboutSelection,
      consumeAskRequest,
      setIsAiResponding,
    }),
    [
      pendingAskRequest,
      isAiResponding,
      askAiAboutSelection,
      consumeAskRequest,
      setIsAiResponding,
    ],
  );

  return (
    <AskAiContext.Provider value={contextValue}>
      {children}
    </AskAiContext.Provider>
  );
}

export function useAskAi() {
  return useContext(AskAiContext);
}
