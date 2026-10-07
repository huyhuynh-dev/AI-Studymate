"use client";

import React, { useState } from "react";
import { HomeHeader, LeftSidebar } from "@/components/home";
import { PanelLeftOpen } from "lucide-react";

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);

    return (
        <div className="flex h-screen w-full flex-col overflow-hidden bg-white">
            {/* Top Header */}
            <HomeHeader />

            {/* Main Workspace */}
            <div className="relative flex flex-1 overflow-hidden">
                {/* Left Sidebar */}
                <LeftSidebar
                    isCollapsed={isLeftCollapsed}
                    onToggleCollapse={() => setIsLeftCollapsed(!isLeftCollapsed)}
                />

                {/* Floating Expand Button for Left Sidebar */}
                {isLeftCollapsed && (
                    <button
                        type="button"
                        onClick={() => setIsLeftCollapsed(false)}
                        title="Mở Không gian học tập"
                        className="absolute top-4 left-4 z-20 flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 text-xs font-semibold text-gray-700 shadow-md backdrop-blur-sm hover:bg-gray-50 hover:text-indigo-600 transition-all cursor-pointer"
                    >
                        <PanelLeftOpen className="h-4 w-4 text-indigo-600" />
                        <span>Không gian học tập</span>
                    </button>
                )}

                {children}
            </div>
        </div>
    );
}

