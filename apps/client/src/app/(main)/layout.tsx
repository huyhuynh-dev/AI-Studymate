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
        <div className="flex h-screen w-full flex-col overflow-hidden bg-white">
            {/* Main Workspace Area */}
            <div className="relative flex flex-1 overflow-hidden">
                {/* Navigation Sidebar Area */}
                <aside className="z-20 shrink-0 transition-all duration-300 ease-in-out">
                    <React.Suspense fallback={<div className="w-64 h-full bg-slate-50 border-r border-gray-200" />}>
                        <LeftSidebar
                            isCollapsed={effectiveLeftCollapsed}
                            onToggleCollapse={() => setIsLeftCollapsed(!isLeftCollapsed)}
                        />
                    </React.Suspense>
                </aside>

                {/* Center Content Area */}
                <main
                    className={`relative flex-1 bg-slate-50/50 transition-[padding] duration-300 ease-in-out ${
                        isFocusMode
                            ? "p-0 overflow-hidden"
                            : isViewingDocument
                              ? "p-2 sm:p-3 overflow-y-auto"
                              : "p-4 sm:p-6 overflow-y-auto"
                    }`}
                >
                    {/* Wrap the actual page content */}
                    <div className={`min-h-full w-full flex flex-col ${isFocusMode ? "h-full" : ""}`}>
                        {children}
                    </div>
                </main>

                {/* Contextual Right Sidebar Area */}
                {showRightSidebar && (
                    <aside className="z-20 shrink-0">
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
