"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { workspaceStateApi } from "@/services/workspaceState.api";
import {
  buildRestoreHref,
  isDefaultHomeEntry,
} from "@/lib/workspace-state-rules";
import { workspaceStateCoordinator } from "@/lib/workspace-state.singleton";
import type {
  ValidConversationTab,
  WorkspaceDocumentState,
  WorkspaceLayoutState,
} from "@/types/workspace-state";

export type BootstrapStatus = "bootstrapping" | "settled" | "unknown";

export interface ConversationIntentSnapshot {
  readonly conversationId: string;
  readonly tab: ValidConversationTab | null;
  readonly document: WorkspaceDocumentState | null;
  readonly summaryId: string | null;
  readonly deckId: string | null;
  readonly quizId: string | null;
  readonly chatSessionId: string | null;
}

interface MutableConversationIntent {
  readonly conversationId: string;
  tab: ValidConversationTab | null;
  document: WorkspaceDocumentState | null;
  summaryId: string | null;
  deckId: string | null;
  quizId: string | null;
  chatSessionId: string | null;
}

export interface WorkspaceRestoreContextValue {
  readonly status: BootstrapStatus;
  readonly isRedirectingFromHome: boolean;
  readonly shouldHoldHomeRender: boolean;
  readonly isHoldingConversationTab: (conversationId: string) => boolean;
  readonly restoredLayout: WorkspaceLayoutState | null;
  readonly peekConversationIntent: (
    conversationId: string,
  ) => ConversationIntentSnapshot | null;
  readonly clearTabDetailIntent: (conversationId: string) => void;
  readonly clearChatSessionIntent: (conversationId: string) => void;
}

const BOOTSTRAP_TIMEOUT_MS = 2500;
const REDIRECT_HOLD_TIMEOUT_MS = 2000;

const WorkspaceRestoreContext = createContext<WorkspaceRestoreContextValue>({
  status: "settled",
  isRedirectingFromHome: false,
  shouldHoldHomeRender: false,
  isHoldingConversationTab: () => false,
  restoredLayout: null,
  peekConversationIntent: () => null,
  clearTabDetailIntent: () => {},
  clearChatSessionIntent: () => {},
});

function hasExplicitConversationQuery(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return Boolean(
    params.get("tab") ||
      params.get("docId") ||
      params.get("deckId") ||
      window.sessionStorage.getItem("studymate:open-summary-id") ||
      window.sessionStorage.getItem("studymate:open-deck-id") ||
      window.sessionStorage.getItem("studymate:open-quiz-id"),
  );
}

export function WorkspaceRestoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user: currentUser } = useCurrentUser();

  const [status, setStatus] = useState<BootstrapStatus>("bootstrapping");
  const [isRedirectingFromHome, setIsRedirectingFromHome] = useState(false);
  const [hasExplicitHomeQuery, setHasExplicitHomeQuery] = useState(false);
  const [restoredLayout, setRestoredLayout] =
    useState<WorkspaceLayoutState | null>(null);
  const intentRef = useRef<MutableConversationIntent | null>(null);
  const bootstrapStartedRef = useRef(false);
  const latestPathnameRef = useRef(pathname);

  useEffect(() => {
    latestPathnameRef.current = pathname;
    if (
      pathname === "/home" &&
      typeof window !== "undefined" &&
      !isDefaultHomeEntry(pathname, window.location.search)
    ) {
      setHasExplicitHomeQuery(true);
    } else if (pathname !== "/home") {
      setHasExplicitHomeQuery(false);
      setIsRedirectingFromHome(false);
    }
  }, [pathname]);

  // Bảo vệ nếu router.replace từ /home vì lý do nào đó không đổi route kịp thời
  useEffect(() => {
    if (!isRedirectingFromHome) return;
    const timer = window.setTimeout(() => {
      setIsRedirectingFromHome(false);
    }, REDIRECT_HOLD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [isRedirectingFromHome]);

  // Gắn chặt coordinator với userId hiện hành để ngăn rò rỉ giữa các tài khoản trong SPA
  useEffect(() => {
    workspaceStateCoordinator.bindUser(currentUser?.id ?? null);
  }, [currentUser?.id]);

  // Flush best-effort khi trang bị ẩn hoặc đóng tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        workspaceStateCoordinator.flushKeepalive();
      }
    };
    const handlePageHide = () => {
      workspaceStateCoordinator.flushKeepalive();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  // Bootstrap 1 lần duy nhất mỗi lần shell (main) mount (idempotent với React Strict Mode)
  useEffect(() => {
    if (bootstrapStartedRef.current) return;
    bootstrapStartedRef.current = true;

    const mountPathname =
      typeof window !== "undefined" ? window.location.pathname : pathname;
    const mountSearch =
      typeof window !== "undefined" ? window.location.search : "";

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, BOOTSTRAP_TIMEOUT_MS);

    void workspaceStateApi
      .getState(controller.signal)
      .then((snapshot) => {
        if (snapshot.layout) {
          setRestoredLayout(snapshot.layout);
        }

        workspaceStateCoordinator.seedFromServer(snapshot);

        const currentPath =
          typeof window !== "undefined"
            ? window.location.pathname
            : latestPathnameRef.current;
        const userMovedAway = currentPath !== mountPathname;

        const loc = snapshot.location;
        if (loc && loc.resolution === "valid" && loc.conversationId) {
          intentRef.current = {
            conversationId: loc.conversationId,
            tab: loc.tab ?? null,
            document: loc.document ?? null,
            summaryId: loc.summaryId ?? null,
            deckId: loc.deckId ?? null,
            quizId: loc.quizId ?? null,
            chatSessionId: loc.chatSessionId ?? null,
          };
        }

        if (
          !userMovedAway &&
          isDefaultHomeEntry(mountPathname, mountSearch)
        ) {
          if (loc?.resolution === "valid") {
            const targetHref = buildRestoreHref(loc);
            if (targetHref) {
              setIsRedirectingFromHome(true);
              router.replace(targetHref);
            }
            workspaceStateCoordinator.markSettled();
          } else if (loc?.resolution === "invalid") {
            // Conversation/subject không còn tồn tại -> im lặng ở /home và thay bản ghi cũ
            workspaceStateCoordinator.markSettled();
            workspaceStateCoordinator.reportHome();
          } else {
            workspaceStateCoordinator.markSettled();
          }
        } else {
          workspaceStateCoordinator.markSettled();
        }

        setStatus("settled");
      })
      .catch(() => {
        // Lỗi mạng/5xx/timeout/404 -> unknown: giữ nguyên mặc định, không xóa hoặc ghi đè server
        workspaceStateCoordinator.markUnknown();
        setStatus("unknown");
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });
    // Chỉ chạy một lần khi shell mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shouldHoldHomeRender = useMemo(() => {
    return (
      (status === "bootstrapping" || isRedirectingFromHome) &&
      pathname === "/home" &&
      !hasExplicitHomeQuery
    );
  }, [status, isRedirectingFromHome, pathname, hasExplicitHomeQuery]);

  const isHoldingConversationTab = useCallback(
    (conversationId: string): boolean => {
      if (status !== "bootstrapping") return false;
      if (hasExplicitConversationQuery()) return false;
      const intent = intentRef.current;
      return !intent || intent.conversationId === conversationId;
    },
    [status],
  );

  const peekConversationIntent = useCallback(
    (conversationId: string): ConversationIntentSnapshot | null => {
      const intent = intentRef.current;
      if (!intent || intent.conversationId !== conversationId) return null;
      return {
        conversationId: intent.conversationId,
        tab: intent.tab,
        document: intent.document,
        summaryId: intent.summaryId,
        deckId: intent.deckId,
        quizId: intent.quizId,
        chatSessionId: intent.chatSessionId,
      };
    },
    [],
  );

  const clearTabDetailIntent = useCallback((conversationId: string): void => {
    const intent = intentRef.current;
    if (!intent || intent.conversationId !== conversationId) return;
    intent.tab = null;
    intent.document = null;
    intent.summaryId = null;
    intent.deckId = null;
    intent.quizId = null;
  }, []);

  const clearChatSessionIntent = useCallback((conversationId: string): void => {
    const intent = intentRef.current;
    if (!intent || intent.conversationId !== conversationId) return;
    intent.chatSessionId = null;
  }, []);

  const value = useMemo<WorkspaceRestoreContextValue>(
    () => ({
      status,
      isRedirectingFromHome,
      shouldHoldHomeRender,
      isHoldingConversationTab,
      restoredLayout,
      peekConversationIntent,
      clearTabDetailIntent,
      clearChatSessionIntent,
    }),
    [
      status,
      isRedirectingFromHome,
      shouldHoldHomeRender,
      isHoldingConversationTab,
      restoredLayout,
      peekConversationIntent,
      clearTabDetailIntent,
      clearChatSessionIntent,
    ],
  );

  return (
    <WorkspaceRestoreContext.Provider value={value}>
      {children}
    </WorkspaceRestoreContext.Provider>
  );
}

export function useWorkspaceRestore(): WorkspaceRestoreContextValue {
  return useContext(WorkspaceRestoreContext);
}
