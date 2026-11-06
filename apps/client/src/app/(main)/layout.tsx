"use client";

import React, { useState, useEffect, useMemo } from "react";
import { LeftSidebar, RightSidebar, FocusModeProvider, useFocusMode } from "@/components/layout";
import { usePathname } from "next/navigation";

function MainLayoutContent({ children }: { children: React.ReactNode }) {
    const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);

    const {
        isFocusMode,
        isViewingDocument,
        setFocusMode,
        setIsViewingDocument,
        isRightSidebarCollapsed,
        setIsRightSidebarCollapsed,
    } = useFocusMode();
    const pathname = usePathname();

    // Extract subjectId from path: /home/{subjectId}/...
    const currentSubjectId = useMemo(() => {
        if (!pathname) return null;
        const parts = pathname.split("/");
        // parts: ['', 'home', '{subjectId}', ...]
        if (parts[1] === "home" && parts[2]) return parts[2];
        return null;
    }, [pathname]);

    // RightSidebar chỉ xuất hiện ở cấp độ Conversation (/home/{subjectId}/{conversationId})
    const showRightSidebar = useMemo(() => {
        if (!pathname) return false;
        const segments = pathname.split("/").filter(Boolean);
        return segments[0] === "home" && segments.length >= 3;
    }, [pathname]);

    // Thoát Focus Mode khi chuyển route
    useEffect(() => {
        setFocusMode(false);
        setIsViewingDocument(false);
    }, [pathname, setFocusMode, setIsViewingDocument]);

    const effectiveLeftCollapsed = isLeftCollapsed || isFocusMode;
    const effectiveRightCollapsed = isRightSidebarCollapsed || !showRightSidebar || isFocusMode;

    return (
        <div className="flex h-screen w-full flex-col overflow-hidden bg-[#F8F9FF] dark:bg-[#090B10] select-none text-[#0B1C30] dark:text-[#EFF0F6]">
            {/* Main Split View Area */}
            <div className="relative flex flex-1 overflow-hidden">
                {/* Navigation Sidebar Area (macOS Split View style) */}
                <aside className="z-20 shrink-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
                    <React.Suspense
                        fallback={
                            <div className="w-68 h-full bg-white dark:bg-[#12151C] border-r border-[#E5EEFF] dark:border-white/[0.08] animate-pulse" />
                        }
                    >
                        <LeftSidebar
                            isCollapsed={effectiveLeftCollapsed}
                            onToggleCollapse={() => setIsLeftCollapsed(!isLeftCollapsed)}
                        />
                    </React.Suspense>
                </aside>

                {/* Center Content Area */}
                <main
                    className={`relative flex-1 transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isFocusMode
                            ? "p-0 overflow-hidden bg-white dark:bg-[#090B10]"
                            : isViewingDocument
                              ? "p-3 sm:p-4 overflow-y-auto"
                              : "p-5 sm:p-8 lg:p-10 overflow-y-auto"
                    }`}
                >
                    {/* Inner content wrapper with maximum focus and fluid readability */}
                    <div className={`min-h-full w-full flex flex-col ${isFocusMode ? "h-full" : "max-w-7xl mx-auto"}`}>
                        {children}
                    </div>
                </main>

                {/* Contextual Right Sidebar Area */}
                {showRightSidebar && (
                    <aside className="z-20 shrink-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
                        <RightSidebar
                            isCollapsed={effectiveRightCollapsed}
                            onToggleCollapse={() => setIsRightSidebarCollapsed(!effectiveRightCollapsed)}
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
            <MainLayoutContent>{children}</MainLayoutContent>
        </FocusModeProvider>
    );
}
