"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

interface FocusModeContextValue {
  /** Trạng thái Chế độ tập trung (Focus Mode / Partial Fullscreen) */
  isFocusMode: boolean;
  setFocusMode: (value: boolean) => void;
  toggleFocusMode: () => void;
  /** Trạng thái đang mở trình xem tài liệu chi tiết (PDF / Ảnh) để tối ưu padding chống Box-in-box */
  isViewingDocument: boolean;
  setIsViewingDocument: (value: boolean) => void;
  /** Trạng thái thu gọn RightSidebar (Trợ lý AI) */
  isRightSidebarCollapsed: boolean;
  setIsRightSidebarCollapsed: (value: boolean) => void;
  toggleRightSidebar: () => void;
}

const FocusModeContext = createContext<FocusModeContextValue>({
  isFocusMode: false,
  setFocusMode: () => {},
  toggleFocusMode: () => {},
  isViewingDocument: false,
  setIsViewingDocument: () => {},
  isRightSidebarCollapsed: false,
  setIsRightSidebarCollapsed: () => {},
  toggleRightSidebar: () => {},
});

export function FocusModeProvider({ children }: { children: React.ReactNode }) {
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isViewingDocument, setIsViewingDocumentState] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);

  const toggleRightSidebar = useCallback(() => {
    setIsRightSidebarCollapsed((prev) => !prev);
  }, []);

  const setFocusMode = useCallback((value: boolean) => {
    setIsFocusMode(value);
  }, []);

  const toggleFocusMode = useCallback(() => {
    setIsFocusMode((prev) => !prev);
  }, []);

  const setIsViewingDocument = useCallback((value: boolean) => {
    setIsViewingDocumentState(value);
    if (!value) {
      setIsFocusMode(false);
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      isFocusMode,
      setFocusMode,
      toggleFocusMode,
      isViewingDocument,
      setIsViewingDocument,
      isRightSidebarCollapsed,
      setIsRightSidebarCollapsed,
      toggleRightSidebar,
    }),
    [
      isFocusMode,
      setFocusMode,
      toggleFocusMode,
      isViewingDocument,
      setIsViewingDocument,
      isRightSidebarCollapsed,
      setIsRightSidebarCollapsed,
      toggleRightSidebar,
    ]
  );

  return (
    <FocusModeContext.Provider value={contextValue}>
      {children}
    </FocusModeContext.Provider>
  );
}

export function useFocusMode() {
  return useContext(FocusModeContext);
}
