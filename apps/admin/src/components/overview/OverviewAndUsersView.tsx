'use client';

import type { FormEvent } from 'react';
import { IconSearch, IconUsers } from '@/components/ui/AdminIcons';
import type { AdminOverviewData, AdminUserItem } from '@/types/admin';

interface OverviewAndUsersViewProps {
  overview: AdminOverviewData | null;
  users: AdminUserItem[];
  totalUsersMatched: number;
  currentAdminId: string | null;
  userSearch: string;
  onUserSearchChange: (val: string) => void;
  onSubmitSearch: (searchValue: string) => void;
  userRoleFilter: 'all' | 'admin' | 'user';
  onChangeRoleFilter: (role: 'all' | 'admin' | 'user') => void;
  actionLoadingId: string | null;
  onToggleUserActive: (user: AdminUserItem) => void;
  onToggleUserRole: (user: AdminUserItem) => void;
}

function formatNumber(val: number): string {
  return new Intl.NumberFormat('vi-VN').format(val);
}

function formatUsd(val: number): string {
  return `$${val.toFixed(6)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function OverviewAndUsersView({
  overview,
  users,
  totalUsersMatched,
  currentAdminId,
  userSearch,
  onUserSearchChange,
  onSubmitSearch,
  userRoleFilter,
  onChangeRoleFilter,
  actionLoadingId,
  onToggleUserActive,
  onToggleUserRole,
}: OverviewAndUsersViewProps) {
  const totalDocs = overview?.totals.documents ?? 0;
  const doneDocs = overview?.documentsByStatus.done ?? 0;
  const docSuccessRate =
    totalDocs > 0 ? Math.round((doneDocs / totalDocs) * 100) : 100;

  const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmitSearch(userSearch);
  };

  return (
    <div className="space-y-8">
      {/* BENTO GRID OVERVIEW */}
      <section aria-label="Tổng quan Hệ sinh thái" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Focal Card: Knowledge Base & Vector Ingestion (col-span-2 row-span-2 on xl) */}
        <div className="md:col-span-2 xl:row-span-2 rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]">
          <div className="h-full rounded-[16px] p-5 bg-[#1C1C22]/75 border border-white/[0.06] flex flex-col justify-between gap-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[12px] font-medium uppercase tracking-wider text-[#A1A1AA]">
                  Kho Tri thức & Vector 768d
                </p>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="tabular-nums text-[36px] font-semibold tracking-[-0.03em] leading-none text-[#F5F5F7]">
                    {formatNumber(overview?.totals.documentChunks ?? 0)}
                  </span>
                  <span className="text-[13.5px] text-[#A1A1AA]">
                    chunks đã lập chỉ mục
                  </span>
                </div>
              </div>

              <span className="tabular-nums px-3 py-1 rounded-full text-[12px] font-medium bg-[#30D158]/15 text-[#30D158] border border-[#30D158]/30">
                Hoàn tất {docSuccessRate}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-[#A1A1AA]">
                  Tổng số tài liệu gốc:{' '}
                  <strong className="tabular-nums text-[#F5F5F7]">
                    {formatNumber(totalDocs)}
                  </strong>
                </span>
                <span className="tabular-nums text-[#A1A1AA]">
                  {formatNumber(doneDocs)} / {formatNumber(totalDocs)} tài liệu
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#0A84FF] transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, docSuccessRate))}%` }}
                />
              </div>
            </div>

            {/* Nested 4 status pills: concentric radius 16 - 4 = 12px */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-[12px] p-3 bg-[#121216] border border-white/[0.06]">
                <p className="text-[11.5px] text-[#A1A1AA]">Hoàn tất</p>
                <p className="mt-1 tabular-nums text-[20px] font-semibold tracking-tight text-[#30D158]">
                  {formatNumber(overview?.documentsByStatus.done ?? 0)}
                </p>
              </div>
              <div className="rounded-[12px] p-3 bg-[#121216] border border-white/[0.06]">
                <p className="text-[11.5px] text-[#A1A1AA]">Đang xử lý</p>
                <p className="mt-1 tabular-nums text-[20px] font-semibold tracking-tight text-[#0A84FF]">
                  {formatNumber(overview?.documentsByStatus.processing ?? 0)}
                </p>
              </div>
              <div className="rounded-[12px] p-3 bg-[#121216] border border-white/[0.06]">
                <p className="text-[11.5px] text-[#A1A1AA]">Đang chờ</p>
                <p className="mt-1 tabular-nums text-[20px] font-semibold tracking-tight text-[#FFD60A]">
                  {formatNumber(overview?.documentsByStatus.pending ?? 0)}
                </p>
              </div>
              <div className="rounded-[12px] p-3 bg-[#121216] border border-white/[0.06]">
                <p className="text-[11.5px] text-[#A1A1AA]">Thất bại</p>
                <p className="mt-1 tabular-nums text-[20px] font-semibold tracking-tight text-[#FF453A]">
                  {formatNumber(overview?.documentsByStatus.failed ?? 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stat Card 1: Users */}
        <div className="rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]">
          <div className="h-full rounded-[16px] p-5 bg-[#1C1C22]/55 border border-white/[0.05] flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-[#A1A1AA]">
                Tài khoản Hệ thống
              </span>
              <IconUsers className="w-4 h-4 text-[#0A84FF]" />
            </div>
            <div>
              <p className="tabular-nums text-[28px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
                {formatNumber(overview?.totals.users ?? 0)}
              </p>
              <p className="mt-1 tabular-nums text-[12.5px] text-[#30D158]">
                {formatNumber(overview?.totals.activeUsers ?? 0)} đang hoạt động
              </p>
            </div>
          </div>
        </div>

        {/* Stat Card 2: AI Last 24h */}
        <div className="rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]">
          <div className="h-full rounded-[16px] p-5 bg-[#1C1C22]/55 border border-white/[0.05] flex flex-col justify-between gap-3">
            <span className="text-[12.5px] font-medium text-[#A1A1AA]">
              Lưu lượng AI (24h qua)
            </span>
            <div>
              <p className="tabular-nums text-[28px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
                {formatNumber(overview?.aiLast24Hours.totalTokens ?? 0)}
                <span className="ml-1.5 text-[13px] font-normal text-[#A1A1AA]">
                  tokens
                </span>
              </p>
              <p className="mt-1 tabular-nums text-[12.5px] text-[#A1A1AA]">
                {formatNumber(overview?.aiLast24Hours.requests ?? 0)} requests •{' '}
                <span className="text-[#F5F5F7]">
                  {formatUsd(overview?.aiLast24Hours.estimatedCostUsd ?? 0)}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Stat Card 3: Subjects & Conversations */}
        <div className="rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]">
          <div className="h-full rounded-[16px] p-5 bg-[#1C1C22]/55 border border-white/[0.05] flex flex-col justify-between gap-3">
            <span className="text-[12.5px] font-medium text-[#A1A1AA]">
              Không gian Học tập
            </span>
            <div>
              <p className="tabular-nums text-[28px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
                {formatNumber(overview?.totals.conversations ?? 0)}
                <span className="ml-1.5 text-[13px] font-normal text-[#A1A1AA]">
                  phiên học
                </span>
              </p>
              <p className="mt-1 tabular-nums text-[12.5px] text-[#A1A1AA]">
                Thuộc {formatNumber(overview?.totals.subjects ?? 0)} môn học
              </p>
            </div>
          </div>
        </div>

        {/* Stat Card 4: Flashcards SM-2 & Quizzes */}
        <div className="rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]">
          <div className="h-full rounded-[16px] p-5 bg-[#1C1C22]/55 border border-white/[0.05] flex flex-col justify-between gap-3">
            <span className="text-[12.5px] font-medium text-[#A1A1AA]">
              Ôn tập SM-2 & Đánh giá
            </span>
            <div>
              <p className="tabular-nums text-[28px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
                {formatNumber(overview?.totals.flashcardReviews ?? 0)}
                <span className="ml-1.5 text-[13px] font-normal text-[#A1A1AA]">
                  lượt ôn thẻ
                </span>
              </p>
              <p className="mt-1 tabular-nums text-[12.5px] text-[#A1A1AA]">
                {formatNumber(overview?.totals.flashcards ?? 0)} thẻ •{' '}
                {formatNumber(overview?.totals.quizzes ?? 0)} đề Quiz (
                {formatNumber(overview?.totals.quizAttempts ?? 0)} lượt thi)
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* USER MANAGEMENT TABLE */}
      <section className="rounded-[24px] p-2 bg-[#121216] border border-white/[0.08]">
        <div className="rounded-[16px] p-6 bg-[#1C1C22]/45 border border-white/[0.05] space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-[#F5F5F7]">
                Quản lý Tài khoản & Phân quyền
              </h2>
              <p className="tabular-nums mt-0.5 text-[13px] text-[#A1A1AA]">
                Đang hiển thị {formatNumber(users.length)} /{' '}
                {formatNumber(totalUsersMatched)} tài khoản
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Role Segmented Filter */}
              <div className="inline-flex p-1 rounded-[12px] bg-[#121216] border border-white/[0.08]">
                {(
                  [
                    { key: 'all', label: 'Tất cả' },
                    { key: 'admin', label: 'Quản trị' },
                    { key: 'user', label: 'Thành viên' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onChangeRoleFilter(item.key)}
                    className={`spring-interactive min-h-[32px] px-3 rounded-[9px] text-[12.5px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF] ${
                      userRoleFilter === item.key
                        ? 'bg-[#2C2C34] text-[#F5F5F7]'
                        : 'text-[#A1A1AA] hover:text-[#F5F5F7]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Search Input */}
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                <div className="relative">
                  <IconSearch className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={userSearch}
                    onChange={(e) => onUserSearchChange(e.target.value)}
                    placeholder="Tìm tên hoặc email..."
                    aria-label="Tìm kiếm tài khoản"
                    className="h-9 w-56 sm:w-64 pl-9 pr-3 rounded-[10px] bg-[#121216] border border-white/[0.1] text-[13px] text-[#F5F5F7] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
                  />
                </div>
                <button
                  type="submit"
                  className="spring-interactive min-h-[36px] px-3.5 rounded-[10px] text-[12.5px] font-medium bg-white/[0.06] text-[#F5F5F7] border border-white/[0.08] hover:bg-white/[0.11] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]"
                >
                  Lọc
                </button>
              </form>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[12px] border border-white/[0.06]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#121216] text-[11.5px] font-medium uppercase tracking-wider text-[#71717A] border-b border-white/[0.08]">
                  <th className="py-3 px-4">Người dùng</th>
                  <th className="py-3 px-4">Xác thực & Nguồn</th>
                  <th className="py-3 px-4 text-right">Học liệu</th>
                  <th className="py-3 px-4 text-right">AI & Token</th>
                  <th className="py-3 px-4">Vai trò</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-[13px]">
                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-10 px-4 text-center text-[#A1A1AA]"
                    >
                      Không tìm thấy tài khoản nào khớp với điều kiện lọc.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const isSelf = Boolean(currentAdminId && user.id === currentAdminId);
                    const isRowBusy = actionLoadingId === user.id;

                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-white/[0.025] transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-[#F5F5F7]">
                            {user.name}
                            {isSelf && (
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-[#0A84FF]/18 text-[#0A84FF]">
                                Bạn
                              </span>
                            )}
                          </div>
                          <div className="text-[12px] text-[#A1A1AA]">
                            {user.email}
                          </div>
                          <div className="tabular-nums text-[11px] text-[#71717A] mt-0.5">
                            Tham gia: {formatDate(user.createdAt)}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-medium bg-white/[0.05] text-[#D4D4D8] border border-white/[0.08]">
                            {user.provider === 'google' ? 'Google OAuth' : 'Email / Local'}
                          </span>
                          <div
                            className={`mt-1 text-[11.5px] ${
                              user.isVerified ? 'text-[#30D158]' : 'text-[#FFD60A]'
                            }`}
                          >
                            {user.isVerified ? 'Đã xác thực' : 'Chưa xác thực'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right tabular-nums text-[#D4D4D8]">
                          <div>{formatNumber(user.stats.documentsCount)} tài liệu</div>
                          <div className="text-[11.5px] text-[#71717A]">
                            {formatNumber(user.stats.subjectsCount)} môn •{' '}
                            {formatNumber(user.stats.conversationsCount)} phiên
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right tabular-nums text-[#D4D4D8]">
                          <div>{formatNumber(user.stats.totalTokensUsed)} tok</div>
                          <div className="text-[11.5px] text-[#71717A]">
                            {formatNumber(user.stats.aiRequestsCount)} lượt gọi
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-medium border ${
                              user.role === 'admin'
                                ? 'bg-[#0A84FF]/15 text-[#0A84FF] border-[#0A84FF]/30'
                                : 'bg-white/[0.05] text-[#A1A1AA] border-white/[0.08]'
                            }`}
                          >
                            {user.role === 'admin' ? 'Admin' : 'Thành viên'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-medium border ${
                              user.isActive
                                ? 'bg-[#30D158]/15 text-[#30D158] border-[#30D158]/30'
                                : 'bg-[#FF453A]/15 text-[#FF453A] border-[#FF453A]/30'
                            }`}
                          >
                            {user.isActive ? 'Hoạt động' : 'Đã khóa'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={isSelf || isRowBusy}
                              onClick={() => onToggleUserRole(user)}
                              title={
                                isSelf
                                  ? 'Không thể tự thay đổi quyền của chính mình'
                                  : undefined
                              }
                              className="spring-interactive min-h-[32px] px-2.5 rounded-[8px] text-[12px] font-medium bg-white/[0.06] text-[#F5F5F7] border border-white/[0.08] hover:bg-white/[0.12] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF] disabled:opacity-40 disabled:pointer-events-none"
                            >
                              {user.role === 'admin' ? 'Hạ quyền' : 'Cấp Admin'}
                            </button>

                            <button
                              type="button"
                              disabled={isSelf || isRowBusy}
                              onClick={() => onToggleUserActive(user)}
                              title={
                                isSelf
                                  ? 'Không thể tự khóa tài khoản đang đăng nhập'
                                  : undefined
                              }
                              className={`spring-interactive min-h-[32px] px-2.5 rounded-[8px] text-[12px] font-medium border active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF] disabled:opacity-40 disabled:pointer-events-none ${
                                user.isActive
                                  ? 'bg-[#FF453A]/12 text-[#FF453A] border-[#FF453A]/25 hover:bg-[#FF453A]/20'
                                  : 'bg-[#30D158]/15 text-[#30D158] border-[#30D158]/30 hover:bg-[#30D158]/22'
                              }`}
                            >
                              {isRowBusy
                                ? 'Đang lưu...'
                                : user.isActive
                                  ? 'Khóa'
                                  : 'Mở khóa'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
