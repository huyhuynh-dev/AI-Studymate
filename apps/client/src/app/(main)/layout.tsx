"use client";

import React, { useState, useEffect, useMemo } from "react";
import { LeftSidebar, RightSidebar, FocusModeProvider, useFocusMode } from "@/components/layout";
import { PanelLeftOpen, PanelRightOpen, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";

function MainLayoutContent({ children }: { children: React.ReactNode }) {
    const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
    const [isRightCollapsed, setIsRightCollapsed] = useState(false);

    const { isFocusMode, isViewingDocument, setFocusMode, setIsViewingDocument } = useFocusMode();
    const pathname = usePathname();

    // Extract subjectId from path: /home/{subjectId}/...
    const currentSubjectId = useMemo(() => {
        if (!pathname) return null;
        const parts = pathname.split("/");
        // parts: ['', 'home', '{subjectId}', ...]
        if (parts[1] === "home" && parts[2]) return parts[2];
        return null;
    }, [pathname]);

    // The RightSidebar is shown on /home routes.
    const showRightSidebar = Boolean(pathname?.startsWith("/home"));

    // Thoát Focus Mode khi chuyển route
    useEffect(() => {
        setFocusMode(false);
        setIsViewingDocument(false);
    }, [pathname, setFocusMode, setIsViewingDocument]);

    const effectiveLeftCollapsed = isLeftCollapsed || isFocusMode;
    const effectiveRightCollapsed = isRightCollapsed || !showRightSidebar;

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

                {/* Left Sidebar Toggle Button */}
                {effectiveLeftCollapsed && !isFocusMode && (
                    <div className="absolute top-4 left-4 z-20">
                        <button
                            type="button"
                            onClick={() => setIsLeftCollapsed(false)}
                            title="Mở Không gian học tập"
                            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 text-xs font-semibold text-gray-700 shadow-md backdrop-blur-sm hover:bg-gray-50 hover:text-indigo-600 transition-all cursor-pointer"
                        >
                            <PanelLeftOpen className="h-4 w-4 text-indigo-600" />
                            <span>Không gian học tập</span>
                        </button>
                    </div>
                )}

                {/* Center Content Area */}
                <main
                    className={`relative flex-1 bg-slate-50/50 transition-all duration-300 ease-in-out ${
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

                    {/* Right Sidebar Toggle Button */}
                    {showRightSidebar && effectiveRightCollapsed && (
                        <div className="absolute top-4 right-4 z-20">
                            <button
                                type="button"
                                onClick={() => setIsRightCollapsed(false)}
                                title="Mở Trợ lý StudyMate AI"
                                className="flex items-center gap-1.5 rounded-xl border border-indigo-100 bg-white/95 px-3 py-2 text-xs font-semibold text-indigo-600 shadow-md backdrop-blur-sm hover:bg-indigo-50 transition-all cursor-pointer"
                            >
                                <Sparkles className="h-4 w-4" />
                                <span>StudyMate AI</span>
                                <PanelRightOpen className="h-4 w-4 ml-0.5" />
                            </button>
                        </div>
                    )}
                </main>

                {/* Contextual Right Sidebar Area */}
                {showRightSidebar && (
                    <aside className="z-20 shrink-0">
                        <RightSidebar
                            isCollapsed={effectiveRightCollapsed}
                            onToggleCollapse={() => setIsRightCollapsed(!effectiveRightCollapsed)}
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
