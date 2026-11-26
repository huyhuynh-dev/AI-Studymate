import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Tạo instance axios mặc định cho client
export const axiosClient = axios.create({
  // Mọi request từ Frontend sẽ tự động đi qua "Cổng Proxy" của Next.js thay vì gọi thẳng Backend
  baseURL: '/api/proxy',
  headers: {
    'Content-Type': 'application/json',
  },
});

const AUTH_REFRESH_CHANNEL_NAME = 'studymate_auth_refresh_channel';
const AUTH_REFRESH_LOCK_NAME = 'studymate_auth_refresh_lock';
const CROSS_TAB_REFRESH_GRACE_MS = 4000;

// Trạng thái khóa (lock) trong tab hiện tại
let isRefreshing = false;
let lastCrossTabRefreshAt = 0;

const authChannel =
  typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel(AUTH_REFRESH_CHANNEL_NAME)
    : null;

if (authChannel) {
  authChannel.onmessage = (event: MessageEvent<{ type?: string; timestamp?: number }>) => {
    if (event.data?.type === 'REFRESH_SUCCESS' && typeof event.data.timestamp === 'number') {
      lastCrossTabRefreshAt = Math.max(lastCrossTabRefreshAt, event.data.timestamp);
    }
  };
}

// Hàng đợi In-memory: Lưu giữ các request bị lỗi 401 tạm thời trong lúc chờ token mới
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

async function executeCoordinatedRefresh(): Promise<void> {
  const performRefresh = async () => {
    if (Date.now() - lastCrossTabRefreshAt < CROSS_TAB_REFRESH_GRACE_MS) {
      return;
    }

    await axios.get('/api/auth/refresh');
    const now = Date.now();
    lastCrossTabRefreshAt = now;
    authChannel?.postMessage({ type: 'REFRESH_SUCCESS', timestamp: now });
  };

  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    await navigator.locks.request(AUTH_REFRESH_LOCK_NAME, performRefresh);
    return;
  }

  await performRefresh();
}

// Response Interceptor: Tự động chặn và xử lý mọi response trả về
axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Chỉ can thiệp nếu lỗi là 401 (Unauthorized) và request này chưa từng được retry
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => axiosClient(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await executeCoordinatedRefresh();
        isRefreshing = false;
        processQueue(null);
        return axiosClient(originalRequest);
      } catch (refreshError: unknown) {
        isRefreshing = false;
        processQueue(refreshError);

        const refreshStatus = axios.isAxiosError(refreshError)
          ? refreshError.response?.status
          : undefined;

        // Chỉ chuyển hướng về trang Đăng nhập khi refresh token thực sự hết hạn/không hợp lệ
        if (
          typeof window !== 'undefined' &&
          (refreshStatus === 401 || refreshStatus === 403)
        ) {
          window.location.href = '/auth/login?session_expired=true';
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
