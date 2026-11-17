'use client';

import { AdminHeader } from '@/components/layout/AdminHeader';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { OverviewAndUsersView } from '@/components/overview/OverviewAndUsersView';
import { QueueMonitorView } from '@/components/queues/QueueMonitorView';
import { AiTelemetryView } from '@/components/telemetry/AiTelemetryView';
import { RagBenchmarkView } from '@/components/benchmark/RagBenchmarkView';
import { IconAlert, IconCheck } from '@/components/ui/AdminIcons';
import { useAdminConsole } from '@/hooks/useAdminConsole';

function ConsoleSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="md:col-span-2 h-64 rounded-[24px] bg-[#121216] border border-white/[0.06]" />
        <div className="h-32 rounded-[24px] bg-[#121216] border border-white/[0.06]" />
        <div className="h-32 rounded-[24px] bg-[#121216] border border-white/[0.06]" />
      </div>
      <div className="h-80 rounded-[24px] bg-[#121216] border border-white/[0.06]" />
    </div>
  );
}

export default function AdminDashboardPage() {
  const {
    activeTab,
    switchTab,
    adminUser,
    isInitializing,
    isRefreshing,
    autoRefreshQueues,
    setAutoRefreshQueues,
    lastSyncedAt,
    overview,
    usersData,
    filteredUsers,
    userSearch,
    setUserSearch,
    userRoleFilter,
    setUserRoleFilter,
    queueData,
    aiUsage,
    windowDays,
    ragReport,
    actionLoadingId,
    isRunningBenchmark,
    isLoggingOut,
    tabError,
    toasts,
    dismissToast,
    refreshActiveTab,
    handleSearchUsers,
    handleChangeWindowDays,
    handleToggleUserActive,
    handleToggleUserRole,
    handleRetryJob,
    handleRemoveJob,
    handleRunRagBenchmark,
    handleLogout,
  } = useAdminConsole();

  const failedJobsCount = queueData?.queue.counts.failed ?? 0;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#08080A] text-[#F5F5F7]">
      <AdminSidebar
        activeTab={activeTab}
        onSelectTab={switchTab}
        adminUser={adminUser}
        failedJobsCount={failedJobsCount}
        isLoggingOut={isLoggingOut}
        onLogout={handleLogout}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <AdminHeader
          activeTab={activeTab}
          health={overview?.health ?? null}
          lastSyncedAt={lastSyncedAt}
          isRefreshing={isRefreshing}
          isRunningBenchmark={isRunningBenchmark}
          autoRefreshQueues={autoRefreshQueues}
          onToggleAutoRefresh={setAutoRefreshQueues}
          onRefresh={refreshActiveTab}
          onRunBenchmark={handleRunRagBenchmark}
        />

        <main className="flex-1 px-6 py-6">
          <div className="max-w-[1400px] mx-auto space-y-6">
            {tabError && (
              <div
                role="alert"
                className="flex items-center justify-between gap-4 p-4 rounded-[16px] bg-[#FF453A]/12 border border-[#FF453A]/30 text-[13.5px] text-[#FF8A82]"
              >
                <div className="flex items-center gap-2.5">
                  <IconAlert className="w-4 h-4 shrink-0 text-[#FF453A]" />
                  <span>{tabError}</span>
                </div>
                <button
                  type="button"
                  onClick={refreshActiveTab}
                  className="spring-interactive px-3 py-1.5 rounded-[9px] text-[12.5px] font-medium bg-[#FF453A]/20 text-white hover:bg-[#FF453A]/30"
                >
                  Thử lại
                </button>
              </div>
            )}

            {isInitializing ? (
              <ConsoleSkeleton />
            ) : (
              <>
                {activeTab === 'overview' && (
                  <OverviewAndUsersView
                    overview={overview}
                    users={filteredUsers}
                    totalUsersMatched={usersData?.total ?? filteredUsers.length}
                    currentAdminId={adminUser?.id ?? null}
                    userSearch={userSearch}
                    onUserSearchChange={setUserSearch}
                    onSubmitSearch={handleSearchUsers}
                    userRoleFilter={userRoleFilter}
                    onChangeRoleFilter={setUserRoleFilter}
                    actionLoadingId={actionLoadingId}
                    onToggleUserActive={handleToggleUserActive}
                    onToggleUserRole={handleToggleUserRole}
                  />
                )}

                {activeTab === 'queues' && (
                  <QueueMonitorView
                    queueData={queueData}
                    actionLoadingId={actionLoadingId}
                    onRetryJob={handleRetryJob}
                    onRemoveJob={handleRemoveJob}
                  />
                )}

                {activeTab === 'ai-telemetry' && (
                  <AiTelemetryView
                    aiUsage={aiUsage}
                    windowDays={windowDays}
                    onChangeWindowDays={handleChangeWindowDays}
                  />
                )}

                {activeTab === 'rag-benchmark' && (
                  <RagBenchmarkView report={ragReport} />
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Floating Apple HIG Toast Stack */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto apple-liquid-glass rounded-[14px] px-4 py-3 flex items-start justify-between gap-3 border ${
                toast.variant === 'error'
                  ? 'border-[#FF453A]/35 text-[#FF8A82]'
                  : 'border-[#30D158]/35 text-[#F5F5F7]'
              }`}
            >
              <div className="flex items-start gap-2.5 text-[13px]">
                {toast.variant === 'error' ? (
                  <IconAlert className="w-4 h-4 text-[#FF453A] shrink-0 mt-0.5" />
                ) : (
                  <IconCheck className="w-4 h-4 text-[#30D158] shrink-0 mt-0.5" />
                )}
                <span>{toast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="text-[12px] text-[#71717A] hover:text-[#F5F5F7]"
              >
                Đóng
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
