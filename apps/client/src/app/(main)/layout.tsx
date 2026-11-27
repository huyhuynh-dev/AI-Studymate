"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { LeftSidebar, RightSidebar, FocusModeProvider, useFocusMode } from "@/components/layout";
import { AskAiProvider } from "@/contexts/AskAiContext";
import { CitationNavigationProvider, useCitationNavigation } from "@/contexts/CitationNavigationContext";
import { useThemePreference } from "@/contexts/ThemePreferenceProvider";
import { WordAgentProvider } from "@/contexts/WordAgentContext";
import {
    WorkspaceContextProvider,
    useWorkspaceContextStore,
} from "@/contexts/WorkspaceContextProvider";
import {
    WorkspaceRestoreProvider,
    useWorkspaceRestore,
} from "@/contexts/WorkspaceRestoreContext";
import type { WorkspacePageType } from "@/contexts/workspace-context.types";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { isValidUuid } from "@/lib/workspace-state-rules";
import { workspaceStateCoordinator } from "@/lib/workspace-state.singleton";
import { usePathname, useRouter } from "next/navigation";
import { StudyMateAiIcon } from "@/components/ui/StudyMateAiIcon";

function MainLayoutContent({ children }: { children: React.ReactNode }) {
    const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
    const router = useRouter();
    const { user: currentUser } = useCurrentUser();
    const { setTheme } = useThemePreference();
    const lastSyncedServerThemeRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        const prefTheme = currentUser?.preferences?.theme;
        if (!prefTheme) return;
        if (lastSyncedServerThemeRef.current === prefTheme) return;
        lastSyncedServerThemeRef.current = prefTheme;
        setTheme(prefTheme, { persistLocal: true });
    }, [currentUser?.preferences?.theme, setTheme]);

    const {
        isFocusMode,
        isViewingDocument,
        setFocusMode,
        setIsViewingDocument,
        isRightSidebarCollapsed,
        setIsRightSidebarCollapsed,
    } = useFocusMode();
    const { sidePanelTarget, closeSidePanelCitation } = useCitationNavigation();
    const workspaceStore = useWorkspaceContextStore();
    const {
        status: restoreStatus,
        isRedirectingFromHome,
        shouldHoldHomeRender,
        restoredLayout,
    } = useWorkspaceRestore();
    const appliedRestoredLayoutRef = useRef(false);
    const pathname = usePathname();

    // Trích xuất subjectId từ URL: /home/{subjectId}/...
    const currentSubjectId = useMemo(() => {
        if (!pathname) return null;
        const parts = pathname.split("/");
        // parts: ['', 'home', '{subjectId}', ...]
        if (parts[1] === "home" && parts[2]) return parts[2];
        return null;
    }, [pathname]);

    const currentConversationId = useMemo(() => {
        if (!pathname) return null;
        const segments = pathname.split("/").filter(Boolean);
        return segments[0] === "home" && segments.length >= 3 ? segments[2] : null;
    }, [pathname]);

    const currentPageType: WorkspacePageType = useMemo(() => {
        if (!pathname) return "home";
        const segments = pathname.split("/").filter(Boolean);
        if (segments[0] === "profile") return "profile";
        if (segments[0] === "home" && segments.length >= 3) return "conversation";
        if (segments[0] === "home" && segments.length === 2) return "subject";
        return "home";
    }, [pathname]);

    // RightSidebar chỉ xuất hiện ở cấp độ Conversation (/home/{subjectId}/{conversationId})
    const showRightSidebar = useMemo(() => {
        if (!pathname) return false;
        const segments = pathname.split("/").filter(Boolean);
        return segments[0] === "home" && segments.length >= 3;
    }, [pathname]);

    // Thoát Focus Mode & đóng trình xem nguồn bên phải khi chuyển route
    useEffect(() => {
        setFocusMode(false);
        setIsViewingDocument(false);
        closeSidePanelCitation();
    }, [pathname, setFocusMode, setIsViewingDocument, closeSidePanelCitation]);

    // Đồng bộ Location & Side-panel vào Context Engine Store
    useEffect(() => {
        workspaceStore?.setLocation({
            pathname: pathname ?? undefined,
            pageType: currentPageType,
            subjectId: currentSubjectId,
            conversationId: currentConversationId,
            isFocusMode,
        });
    }, [
        workspaceStore,
        pathname,
        currentPageType,
        currentSubjectId,
        currentConversationId,
        isFocusMode,
    ]);

    useEffect(() => {
        if (!workspaceStore) return;
        if (sidePanelTarget?.documentId) {
            workspaceStore.setSidePanel({
                documentId: sidePanelTarget.documentId,
                fileName: sidePanelTarget.fileName,
                pageNo: sidePanelTarget.pageNo,
                citationId: sidePanelTarget.citationId,
            });
        } else {
            workspaceStore.setSidePanel(null);
        }
    }, [workspaceStore, sidePanelTarget]);

    // Áp trạng thái thu gọn sidebar đã lưu một lần từ server (không kích hoạt ghi ngược)
    useEffect(() => {
        if (!restoredLayout || appliedRestoredLayoutRef.current) return;
        appliedRestoredLayoutRef.current = true;
        setIsLeftCollapsed(restoredLayout.leftSidebarCollapsed);
        setIsRightSidebarCollapsed(restoredLayout.rightSidebarCollapsed);
    }, [restoredLayout, setIsRightSidebarCollapsed]);

    // Đồng bộ vị trí route hiện tại vào WorkspaceStateCoordinator khi bootstrap đã xong
    useEffect(() => {
        if (restoreStatus === "bootstrapping") return;
        if (isRedirectingFromHome && currentPageType === "home") return;
        if (currentPageType === "profile") return;

        if (
            currentPageType === "conversation" &&
            isValidUuid(currentSubjectId) &&
            isValidUuid(currentConversationId)
        ) {
            workspaceStateCoordinator.reportConversation(
                currentSubjectId,
                currentConversationId,
            );
            return;
        }

        if (currentPageType === "subject" && isValidUuid(currentSubjectId)) {
            workspaceStateCoordinator.reportSubject(currentSubjectId);
            return;
        }

        if (currentPageType === "home") {
            workspaceStateCoordinator.reportHome();
        }
    }, [
        restoreStatus,
        isRedirectingFromHome,
        currentPageType,
        currentSubjectId,
        currentConversationId,
    ]);

    const effectiveRightCollapsed = sidePanelTarget
        ? !showRightSidebar
        : isRightSidebarCollapsed || !showRightSidebar;

    return (
        <div className="flex h-screen w-full flex-col overflow-hidden bg-[#F8F9FF] dark:bg-[#090B10] select-none text-[#0B1C30] dark:text-[#EFF0F6]">
            {/* Main Split View Area */}
            <div className="relative flex flex-1 overflow-hidden">
                {/* Navigation Sidebar Area (macOS Split View style) */}
                <aside className="z-20 shrink-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
                    <React.Suspense
                        fallback={
                            <div className="w-68 h-full bg-white dark:bg-[#12151C] border-r border-black/[0.06] dark:border-white/[0.08] animate-pulse" />
                        }
                    >
                        <LeftSidebar
                            user={
                                currentUser
                                    ? {
                                          name: currentUser.name,
                                          email: currentUser.email,
                                          avatarUrl: currentUser.avatarUrl ?? undefined,
                                      }
                                    : undefined
                            }
                            isCollapsed={isLeftCollapsed}
                            onToggleCollapse={() => {
                                const nextLeft = !isLeftCollapsed;
                                setIsLeftCollapsed(nextLeft);
                                workspaceStateCoordinator.reportLayout({
                                    leftSidebarCollapsed: nextLeft,
                                    rightSidebarCollapsed: isRightSidebarCollapsed,
                                });
                            }}
                            onSettingsClick={() => router.push("/profile")}
                        />
                    </React.Suspense>
                </aside>

                {/* Center Content Area */}
                <main
                    className={`relative flex-1 transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isFocusMode
                            ? "p-0 overflow-hidden bg-white dark:bg-[#090B10]"
                            : isViewingDocument
                              ? "p-2 sm:p-3 overflow-y-auto"
                              : showRightSidebar
                                ? "p-3 sm:p-4 lg:p-5 overflow-y-auto"
                                : "p-5 sm:p-8 lg:p-10 overflow-y-auto"
                    }`}
                >
                    {showRightSidebar && effectiveRightCollapsed && !sidePanelTarget && (
                        <button
                            type="button"
                            onClick={() => {
                                setIsRightSidebarCollapsed(false);
                                workspaceStateCoordinator.reportLayout({
                                    leftSidebarCollapsed: isLeftCollapsed,
                                    rightSidebarCollapsed: false,
                                });
                            }}
                            aria-label="Mở Trợ lý StudyMate AI"
                            title="Mở Trợ lý StudyMate AI"
                            className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[60] flex h-12 items-center gap-2 rounded-full border border-indigo-200/80 dark:border-indigo-500/40 bg-white/95 dark:bg-[#12151C]/95 px-3.5 text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8] shadow-[0_12px_32px_-12px_rgba(79,70,229,0.45)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-500/60 hover:bg-indigo-50/90 dark:hover:bg-indigo-950/50 active:translate-y-0 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F46E5]"
                        >
                            <StudyMateAiIcon
                                variant="simple"
                                className="h-4 w-4"
                            />
                            <span className="hidden sm:inline">Mở AI</span>
                        </button>
                    )}
                    {/* Inner content wrapper with maximum focus and fluid readability */}
                    <div
                        className={`min-h-full w-full flex flex-col ${
                            isFocusMode
                                ? "h-full"
                                : showRightSidebar
                                  ? "w-full max-w-[1600px] mx-auto"
                                  : "max-w-7xl mx-auto"
                        }`}
                    >
                        {shouldHoldHomeRender ? (
                            <div
                                aria-busy="true"
                                aria-label="Đang khôi phục không gian học tập"
                                className="flex flex-1 flex-col gap-5 py-4 animate-pulse"
                            >
                                <div className="h-9 w-56 rounded-xl bg-neutral-200/70 dark:bg-white/[0.06]" />
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="h-36 rounded-2xl bg-neutral-200/60 dark:bg-white/[0.05]" />
                                    <div className="h-36 rounded-2xl bg-neutral-200/60 dark:bg-white/[0.05]" />
                                    <div className="h-36 rounded-2xl bg-neutral-200/60 dark:bg-white/[0.05]" />
                                </div>
                            </div>
                        ) : (
                            children
                        )}
                    </div>
                </main>

                {/* Contextual Right Sidebar Area */}
                {showRightSidebar && (
                    <aside className="z-20 shrink-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
                        <RightSidebar
                            isCollapsed={effectiveRightCollapsed}
                            onToggleCollapse={() => {
                                const nextRight = !effectiveRightCollapsed;
                                setIsRightSidebarCollapsed(nextRight);
                                workspaceStateCoordinator.reportLayout({
                                    leftSidebarCollapsed: isLeftCollapsed,
                                    rightSidebarCollapsed: nextRight,
                                });
                            }}
                            subjectId={currentSubjectId}
                        />
                    </aside>
                )}
            </div>
        </div>
    );
}

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <FocusModeProvider>
            <WorkspaceContextProvider>
                <WordAgentProvider>
                    <AskAiProvider>
                        <CitationNavigationProvider>
                            <WorkspaceRestoreProvider>
                                <MainLayoutContent>{children}</MainLayoutContent>
                            </WorkspaceRestoreProvider>
                        </CitationNavigationProvider>
                    </AskAiProvider>
                </WordAgentProvider>
            </WorkspaceContextProvider>
        </FocusModeProvider>
    );
}
