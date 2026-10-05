"use client";

import React, { useState } from "react";
import {
  HomeHeader,
  LeftSidebar,
  RightSidebar,
} from "@/components/home";
import { PanelLeftOpen, PanelRightOpen, Sparkles } from "lucide-react";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);

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

        {/* Center Content Area */}
        <main className="relative flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-6 transition-all duration-300">
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

          {/* Floating Expand Button for Right Sidebar */}
          {isRightCollapsed && (
            <button
              type="button"
              onClick={() => setIsRightCollapsed(false)}
              title="Mở Trợ lý StudyMate AI"
              className="absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-xl border border-indigo-100 bg-white/95 px-3 py-2 text-xs font-semibold text-indigo-600 shadow-md backdrop-blur-sm hover:bg-indigo-50 transition-all cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>StudyMate AI</span>
              <PanelRightOpen className="h-4 w-4 ml-0.5" />
            </button>
          )}

          {children}
        </main>

        {/* Right Sidebar */}
        <RightSidebar
          isCollapsed={isRightCollapsed}
          onToggleCollapse={() => setIsRightCollapsed(!isRightCollapsed)}
        />
      </div>
    </div>
  );
}