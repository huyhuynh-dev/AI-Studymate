"use client";

import React, { useState, useEffect } from "react";
import { HomeHeader, LeftSidebar, RightSidebar } from "@/components/layout";
import { PanelLeftOpen, PanelRightOpen, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
    const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
    const [isRightCollapsed, setIsRightCollapsed] = useState(false);

    const pathname = usePathname();

    // The RightSidebar is hidden completely on the profile page as requested.
    // It is shown on /home routes.
    const showRightSidebar = pathname?.startsWith('/home');

    // Force close RightSidebar when navigating to pages that don't need it
    useEffect(() => {
        if (!showRightSidebar) {
            setIsRightCollapsed(true);
        }
    }, [showRightSidebar]);

    return (
        <div className="flex h-screen w-full flex-col overflow-hidden bg-white">
            {/* 1. Global Header Area */}
            <header className="z-30 shrink-0">
                <HomeHeader
                    isCollapsed={isHeaderCollapsed}
                    onToggleCollapse={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                />
            </header>

            {/* 2. Main Workspace Area */}
            <div className="relative flex flex-1 overflow-hidden">
                {/* 2.1 Navigation Sidebar Area */}
                <aside className="z-20 shrink-0">
                    <React.Suspense fallback={<div className="w-64 h-full bg-slate-50 border-r border-gray-200" />}>
                        <LeftSidebar
                            isCollapsed={isLeftCollapsed}
                            onToggleCollapse={() => setIsLeftCollapsed(!isLeftCollapsed)}
                        />
                    </React.Suspense>
                </aside>

                {/* 2.2 Left Sidebar Toggle Button (Floating) */}
                {isLeftCollapsed && (
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
                <main className="relative flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-6 transition-all duration-300">
                    {/* Wrap the actual page content */}
                    <div className="min-h-full w-full flex flex-col">
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

                {/* 2.4 Contextual Right Sidebar Area */}
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
