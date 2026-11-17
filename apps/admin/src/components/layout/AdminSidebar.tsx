'use client';

import type { ReactNode } from 'react';
import {
  IconBenchmark,
  IconLogOut,
  IconOverview,
  IconQueue,
  IconShield,
  IconTelemetry,
} from '@/components/ui/AdminIcons';
import type { AdminSessionUser, AdminTabKey } from '@/types/admin';

interface AdminSidebarProps {
  activeTab: AdminTabKey;
  onSelectTab: (tab: AdminTabKey) => void;
  adminUser: AdminSessionUser | null;
  failedJobsCount: number;
  isLoggingOut: boolean;
  onLogout: () => void;
}

interface NavItem {
  key: AdminTabKey;
  label: string;
  caption: string;
  icon: (props: { className?: string }) => ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    key: 'overview',
    label: 'Tổng quan & Người dùng',
    caption: 'Hệ sinh thái & phân quyền',
    icon: (props) => <IconOverview {...props} />,
  },
  {
    key: 'queues',
    label: 'Hàng đợi BullMQ',
    caption: 'document-processing',
    icon: (props) => <IconQueue {...props} />,
  },
  {
    key: 'ai-telemetry',
    label: 'Token & Chi phí AI',
    caption: 'FeatureKey & ModelProfile',
    icon: (props) => <IconTelemetry {...props} />,
  },
  {
    key: 'rag-benchmark',
    label: 'Thực nghiệm RAG',
    caption: 'Ablation Study 4 chế độ',
    icon: (props) => <IconBenchmark {...props} />,
  },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AD';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function AdminSidebar({
  activeTab,
  onSelectTab,
  adminUser,
  failedJobsCount,
  isLoggingOut,
  onLogout,
}: AdminSidebarProps) {
  return (
    <aside className="apple-liquid-glass w-full lg:w-[272px] lg:min-h-screen shrink-0 lg:sticky lg:top-0 flex flex-col justify-between p-4 border-b lg:border-b-0 lg:border-r border-white/[0.08]">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-10 h-10 rounded-[12px] bg-[#0A84FF]/15 border border-[#0A84FF]/30 flex items-center justify-center text-[#0A84FF] shrink-0">
            <IconShield className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-[#F5F5F7] truncate">
              AI-StudyMate
            </p>
            <p className="text-[12px] text-[#A1A1AA] truncate">
              Operations Console • :3002
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav aria-label="Phân khu quản trị" className="space-y-1.5">
          <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-[#71717A]">
            Phân hệ giám sát
          </p>
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectTab(item.key)}
                className={`spring-interactive w-full min-h-[44px] flex items-center justify-between gap-3 px-3 py-2.5 rounded-[14px] text-left border active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF] ${
                  isActive
                    ? 'bg-[#1C1C22] border-white/[0.12] text-[#F5F5F7]'
                    : 'bg-transparent border-transparent text-[#A1A1AA] hover:bg-white/[0.04] hover:text-[#F5F5F7]'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 ${
                      isActive
                        ? 'bg-[#0A84FF]/18 text-[#0A84FF]'
                        : 'bg-white/[0.04] text-[#A1A1AA]'
                    }`}
                  >
                    {item.icon({ className: 'w-4 h-4' })}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-medium leading-snug truncate">
                      {item.label}
                    </span>
                    <span className="block text-[11.5px] text-[#71717A] truncate">
                      {item.caption}
                    </span>
                  </span>
                </span>

                {item.key === 'queues' && failedJobsCount > 0 && (
                  <span className="tabular-nums px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF453A]/15 text-[#FF453A] border border-[#FF453A]/30">
                    {failedJobsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Admin Session Footer */}
      <div className="mt-6 pt-4 border-t border-white/[0.08]">
        <div className="rounded-[18px] p-2 bg-[#121216] border border-white/[0.08] space-y-2">
          <div className="flex items-center gap-3 p-2 rounded-[10px] bg-[#1C1C22]/70">
            <div className="w-9 h-9 rounded-full bg-[#0A84FF]/20 border border-[#0A84FF]/35 flex items-center justify-center text-[12px] font-semibold text-[#0A84FF] shrink-0">
              {getInitials(adminUser?.name ?? 'Admin')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-[#F5F5F7] truncate">
                {adminUser?.name ?? 'Quản trị viên'}
              </p>
              <p className="text-[11.5px] text-[#A1A1AA] truncate">
                {adminUser?.email ?? 'admin@studymate.local'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isLoggingOut}
            onClick={onLogout}
            className="spring-interactive w-full min-h-[38px] flex items-center justify-center gap-2 px-3 rounded-[10px] text-[13px] font-medium text-[#A1A1AA] bg-white/[0.04] border border-white/[0.06] hover:bg-[#FF453A]/12 hover:text-[#FF453A] hover:border-[#FF453A]/25 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF] disabled:opacity-40 disabled:pointer-events-none"
          >
            <IconLogOut className="w-4 h-4" />
            <span>{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
