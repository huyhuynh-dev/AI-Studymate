"use client";

import React, { useState, useEffect } from "react";
import { HomeHeader, LeftSidebar, RightSidebar, FocusModeProvider, useFocusMode } from "@/components/layout";
import { PanelLeftOpen, PanelRightOpen, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";

function MainLayoutContent({ children }: { children: React.ReactNode }) {
    const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
    const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
    const [isRightCollapsed, setIsRightCollapsed] = useState(false);

    const { isFocusMode, isViewingDocument, setFocusMode, setIsViewingDocument } = useFocusMode();
    const pathname = usePathname();

    // The RightSidebar is hidden completely on the profile page as requested.
    // It is shown on /home routes.
    const showRightSidebar = pathname?.startsWith("/home");

    // Force close RightSidebar when navigating to pages that don't need it
    useEffect(() => {
        if (!showRightSidebar) {
            setIsRightCollapsed(true);
        }
    }, [showRightSidebar]);

    // Thoát Focus Mode khi chuyển route
    useEffect(() => {
        setFocusMode(false);
        setIsViewingDocument(false);
    }, [pathname, setFocusMode, setIsViewingDocument]);

    const effectiveLeftCollapsed = isLeftCollapsed || isFocusMode;

    return (
        <div className="flex h-screen w-full flex-col overflow-hidden bg-white">
            {/* 1. Global Header Area — Trượt lên (Slide up) & Ẩn đi khi vào Focus Mode */}
            <header
                className={`z-30 shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
                    isFocusMode
                        ? "max-h-0 -translate-y-full opacity-0 pointer-events-none"
                        : "max-h-20 translate-y-0 opacity-100"
                }`}
            >
                <HomeHeader
                    isCollapsed={isHeaderCollapsed}
                    onToggleCollapse={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                />
            </header>

            {/* 2. Main Workspace Area */}
            <div className="relative flex flex-1 overflow-hidden">
                {/* 2.1 Navigation Sidebar Area — Tự động Collapse khi vào Focus Mode */}
                <aside className="z-20 shrink-0 transition-all duration-300 ease-in-out">
                    <React.Suspense fallback={<div className="w-64 h-full bg-slate-50 border-r border-gray-200" />}>
                        <LeftSidebar
                            isCollapsed={effectiveLeftCollapsed}
                            onToggleCollapse={() => setIsLeftCollapsed(!isLeftCollapsed)}
                        />
                    </React.Suspense>
                </aside>

                {/* 2.2 Left Sidebar Toggle Button (Floating - Ẩn khi đang trong Focus Mode để không đè lên Toolbar PDF) */}
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

                {/* 2.3 Center Content Area */}
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
                    <div className="h-full min-h-full w-full flex flex-col">
                        {children}
                    </div>

                    {/* Right Sidebar Toggle Button (Floating inside Main Content so it respects its boundaries) */}
                    {showRightSidebar && isRightCollapsed && (
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

                {/* 2.4 Contextual Right Sidebar Area (Luôn được giữ lại trong Focus Mode để hỏi đáp AI) */}
                {showRightSidebar && (
                    <aside className="z-20 shrink-0">
                        <RightSidebar
                            isCollapsed={isRightCollapsed}
                            onToggleCollapse={() => setIsRightCollapsed(!isRightCollapsed)}
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

