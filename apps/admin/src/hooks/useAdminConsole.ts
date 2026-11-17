'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { extractAdminErrorMessage, AdminApiError } from '@/lib/axios.admin';
import { adminApi } from '@/services/admin.api';
import type {
  AdminAiUsageData,
  AdminOverviewData,
  AdminQueueData,
  AdminSessionUser,
  AdminTabKey,
  AdminUserItem,
  AdminUsersListData,
  RagBenchmarkReportData,
} from '@/types/admin';

export interface AdminToastMessage {
  id: string;
  variant: 'success' | 'error' | 'info';
  message: string;
}

export function useAdminConsole() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<AdminTabKey>('overview');
  const [adminUser, setAdminUser] = useState<AdminSessionUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefreshQueues, setAutoRefreshQueues] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [usersData, setUsersData] = useState<AdminUsersListData | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'user'>('all');

  const [queueData, setQueueData] = useState<AdminQueueData | null>(null);
  const [aiUsage, setAiUsage] = useState<AdminAiUsageData | null>(null);
  const [windowDays, setWindowDays] = useState<number>(30);
  const [ragReport, setRagReport] = useState<RagBenchmarkReportData | null>(null);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [tabError, setTabError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<AdminToastMessage[]>([]);

  const toastTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const pushToast = useCallback(
    (variant: AdminToastMessage['variant'], message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, variant, message }]);
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
        toastTimerRef.current.delete(id);
      }, 4200);
      toastTimerRef.current.set(id, timer);
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimerRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimerRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    const timers = toastTimerRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const handleAuthFailure = useCallback(
    (err: unknown) => {
      if (err instanceof AdminApiError && (err.status === 401 || err.status === 403)) {
        router.replace(
          err.status === 403 ? '/login?forbidden=true' : '/login?session_expired=true',
        );
        return true;
      }
      return false;
    },
    [router],
  );

  const loadOverviewAndUsers = useCallback(
    async (searchQuery: string) => {
      const [overviewRes, usersRes] = await Promise.all([
        adminApi.getOverview(),
        adminApi.getUsers({
          search: searchQuery.trim() || undefined,
          limit: 100,
          offset: 0,
        }),
      ]);
      setOverview(overviewRes);
      setUsersData(usersRes);
    },
    [],
  );

  const loadQueueStatus = useCallback(async () => {
    const data = await adminApi.getQueueStatus();
    setQueueData(data);
  }, []);

  const loadAiUsage = useCallback(async (days: number) => {
    const data = await adminApi.getAiUsage(days);
    setAiUsage(data);
  }, []);

  const loadRagBenchmark = useCallback(async () => {
    const data = await adminApi.getRagBenchmark();
    setRagReport(data);
  }, []);

  const refreshTabData = useCallback(
    async (
      tab: AdminTabKey,
      options?: { silent?: boolean; searchOverride?: string; windowDaysOverride?: number },
    ) => {
      if (!options?.silent) {
        setIsRefreshing(true);
      }
      setTabError(null);
      try {
        if (tab === 'overview') {
          await loadOverviewAndUsers(options?.searchOverride ?? userSearch);
        } else if (tab === 'queues') {
          await loadQueueStatus();
        } else if (tab === 'ai-telemetry') {
          await loadAiUsage(options?.windowDaysOverride ?? windowDays);
        } else if (tab === 'rag-benchmark') {
          await loadRagBenchmark();
        }
        setLastSyncedAt(new Date().toISOString());
      } catch (err: unknown) {
        if (handleAuthFailure(err)) return;
        const msg = extractAdminErrorMessage(err);
        setTabError(msg);
      } finally {
        if (!options?.silent) {
          setIsRefreshing(false);
        }
      }
    },
    [
      handleAuthFailure,
      loadAiUsage,
      loadOverviewAndUsers,
      loadQueueStatus,
      loadRagBenchmark,
      userSearch,
      windowDays,
    ],
  );

  // Khởi tạo phiên Admin và tải dữ liệu tổng quan ban đầu
  useEffect(() => {
    let cancelled = false;

    async function bootstrapConsole() {
      setIsInitializing(true);
      setTabError(null);
      try {
        const [profile, overviewRes, usersRes] = await Promise.all([
          adminApi.getCurrentAdminProfile(),
          adminApi.getOverview(),
          adminApi.getUsers({ limit: 100, offset: 0 }),
        ]);
        if (cancelled) return;
        setAdminUser(profile);
        setOverview(overviewRes);
        setUsersData(usersRes);
        setLastSyncedAt(new Date().toISOString());
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof AdminApiError && (err.status === 401 || err.status === 403)) {
          router.replace(
            err.status === 403 ? '/login?forbidden=true' : '/login',
          );
          return;
        }
        setTabError(extractAdminErrorMessage(err));
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    }

    void bootstrapConsole();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Tự động tải dữ liệu khi chuyển tab lần đầu
  const switchTab = useCallback(
    (nextTab: AdminTabKey) => {
      setActiveTab(nextTab);
      setTabError(null);
      if (nextTab === 'queues' && !queueData) {
        void refreshTabData('queues');
      } else if (nextTab === 'ai-telemetry' && !aiUsage) {
        void refreshTabData('ai-telemetry');
      } else if (nextTab === 'rag-benchmark' && !ragReport) {
        void refreshTabData('rag-benchmark');
      }
    },
    [aiUsage, queueData, ragReport, refreshTabData],
  );

  // Tự động làm mới mỗi 15 giây cho Queue Monitor khi bật autoRefreshQueues
  useEffect(() => {
    if (isInitializing || activeTab !== 'queues' || !autoRefreshQueues) {
      return;
    }
    const timer = setInterval(() => {
      void refreshTabData('queues', { silent: true });
    }, 15000);
    return () => clearInterval(timer);
  }, [activeTab, autoRefreshQueues, isInitializing, refreshTabData]);

  const handleSearchUsers = useCallback(
    async (nextSearch: string) => {
      setUserSearch(nextSearch);
      await refreshTabData('overview', { searchOverride: nextSearch });
    },
    [refreshTabData],
  );

  const handleChangeWindowDays = useCallback(
    async (nextDays: number) => {
      setWindowDays(nextDays);
      await refreshTabData('ai-telemetry', { windowDaysOverride: nextDays });
    },
    [refreshTabData],
  );

  const handleToggleUserActive = useCallback(
    async (targetUser: AdminUserItem) => {
      setActionLoadingId(targetUser.id);
      try {
        const updated = await adminApi.updateUserStatus(targetUser.id, {
          isActive: !targetUser.isActive,
        });
        setUsersData((prev) =>
          prev
            ? {
                ...prev,
                users: prev.users.map((item) =>
                  item.id === targetUser.id
                    ? { ...item, isActive: updated.isActive }
                    : item,
                ),
              }
            : prev,
        );
        pushToast(
          'success',
          updated.isActive
            ? `Đã mở khóa tài khoản ${updated.email}`
            : `Đã khóa tài khoản ${updated.email}`,
        );
        void loadOverviewAndUsers(userSearch).catch(() => undefined);
      } catch (err: unknown) {
        if (handleAuthFailure(err)) return;
        pushToast('error', extractAdminErrorMessage(err));
      } finally {
        setActionLoadingId(null);
      }
    },
    [handleAuthFailure, loadOverviewAndUsers, pushToast, userSearch],
  );

  const handleToggleUserRole = useCallback(
    async (targetUser: AdminUserItem) => {
      const nextRole: 'user' | 'admin' =
        targetUser.role === 'admin' ? 'user' : 'admin';
      setActionLoadingId(targetUser.id);
      try {
        const updated = await adminApi.updateUserStatus(targetUser.id, {
          role: nextRole,
        });
        setUsersData((prev) =>
          prev
            ? {
                ...prev,
                users: prev.users.map((item) =>
                  item.id === targetUser.id ? { ...item, role: updated.role } : item,
                ),
              }
            : prev,
        );
        pushToast(
          'success',
          updated.role === 'admin'
            ? `Đã cấp quyền Quản trị viên cho ${updated.email}`
            : `Đã chuyển ${updated.email} về tài khoản Thành viên`,
        );
      } catch (err: unknown) {
        if (handleAuthFailure(err)) return;
        pushToast('error', extractAdminErrorMessage(err));
      } finally {
        setActionLoadingId(null);
      }
    },
    [handleAuthFailure, pushToast],
  );

  const handleRetryJob = useCallback(
    async (jobId: string) => {
      setActionLoadingId(jobId);
      try {
        await adminApi.retryQueueJob(jobId);
        pushToast('success', `Đã đưa job #${jobId} vào hàng đợi chạy lại.`);
        await loadQueueStatus();
        setLastSyncedAt(new Date().toISOString());
      } catch (err: unknown) {
        if (handleAuthFailure(err)) return;
        pushToast('error', extractAdminErrorMessage(err));
      } finally {
        setActionLoadingId(null);
      }
    },
    [handleAuthFailure, loadQueueStatus, pushToast],
  );

  const handleRemoveJob = useCallback(
    async (jobId: string) => {
      setActionLoadingId(jobId);
      try {
        await adminApi.removeQueueJob(jobId);
        pushToast('success', `Đã xóa job #${jobId} khỏi hàng đợi BullMQ.`);
        await loadQueueStatus();
        setLastSyncedAt(new Date().toISOString());
      } catch (err: unknown) {
        if (handleAuthFailure(err)) return;
        pushToast('error', extractAdminErrorMessage(err));
      } finally {
        setActionLoadingId(null);
      }
    },
    [handleAuthFailure, loadQueueStatus, pushToast],
  );

  const handleRunRagBenchmark = useCallback(async () => {
    setIsRunningBenchmark(true);
    try {
      const freshReport = await adminApi.runRagBenchmark();
      setRagReport(freshReport);
      setLastSyncedAt(new Date().toISOString());
      pushToast(
        'success',
        'Đã chạy xong Thực nghiệm Định lượng RAG 4 chế độ và xuất lại báo cáo Markdown.',
      );
    } catch (err: unknown) {
      if (handleAuthFailure(err)) return;
      pushToast('error', extractAdminErrorMessage(err));
    } finally {
      setIsRunningBenchmark(false);
    }
  }, [handleAuthFailure, pushToast]);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await adminApi.logoutAdmin();
    } catch {
      // Vẫn chuyển hướng về /login dù logout best-effort gặp lỗi mạng
    } finally {
      setIsLoggingOut(false);
      router.replace('/login');
    }
  }, [router]);

  const filteredUsers =
    usersData?.users.filter((u) => {
      if (userRoleFilter === 'admin') return u.role === 'admin';
      if (userRoleFilter === 'user') return u.role !== 'admin';
      return true;
    }) ?? [];

  return {
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
    refreshActiveTab: () => refreshTabData(activeTab),
    handleSearchUsers,
    handleChangeWindowDays,
    handleToggleUserActive,
    handleToggleUserRole,
    handleRetryJob,
    handleRemoveJob,
    handleRunRagBenchmark,
    handleLogout,
  };
}
